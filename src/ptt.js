// Push-to-talk / mic toggle + party audio sensing + stream quality.
//
// We wrap navigator.mediaDevices.getUserMedia in the Xbox page so every audio
// track it captures is registered with us; muting flips `track.enabled` at
// the source — the page receives pure silence no matter what its UI does.
//
// We also wrap RTCPeerConnection twice over:
//  - inbound party audio runs through an AnalyserNode for the HUD light
//  - the SDP answer advertises a higher bandwidth cap (b=AS/b=TIAS) on video
//    sections, because xCloud assigns unknown browsers a starved bitrate
//    profile (~4-6 Mbps even at 1440p). The server still adapts DOWN on a
//    weak network — this only raises the ceiling.
const config = require('./config');

let xboxContents = null;
let muted = false;
const listeners = new Set();

const INJECT = String.raw`(() => {
  if (window.__grMic) return;
  const state = {
    tracks: new Set(), muted: __GR_MUTED__, remote: 0, kbps: __GR_KBPS__,
    pads: 0, gainPct: __GR_GAIN__, gainNode: null, gainVideo: null,
  };
  window.__grMic = {
    setMuted(m) {
      state.muted = !!m;
      for (const t of state.tracks) t.enabled = !state.muted;
      return state.muted;
    },
    isMuted: () => state.muted,
    // Applies to streams negotiated from now on (i.e. the next game launch).
    setKbps(k) { state.kbps = k | 0; },
    // Peak inbound level since last read (decays so the light goes out).
    remoteLevel() { const v = state.remote; state.remote *= 0.5; return v; },
    pads: () => state.pads,
    // Game-stream volume boost. 100% leaves the native audio path untouched;
    // above that, the <video> element is routed through a GainNode.
    setGain(pct) {
      state.gainPct = pct | 0;
      applyGain();
    },
  };
  const applyGain = () => {
    try {
      const v = document.querySelector('video');
      if (!v) return;
      if (state.gainPct === 100 && !state.gainNode) return; // never touched
      const ctx = window.__grCtx || (window.__grCtx = new AudioContext());
      if (state.gainVideo !== v) {
        // New game stream (or first boost): rebuild the graph on this element.
        const src = ctx.createMediaElementSource(v);
        state.gainNode = ctx.createGain();
        src.connect(state.gainNode).connect(ctx.destination);
        state.gainVideo = v;
      }
      state.gainNode.gain.value = state.gainPct / 100;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
  };
  // Rebind the gain graph when a new game launches (fresh <video> element),
  // and track controller presence for the shell's indicator.
  window.addEventListener('gamepadconnected', () => (state.pads += 1));
  window.addEventListener('gamepaddisconnected', () => {
    state.pads = Math.max(0, state.pads - 1);
  });
  setInterval(() => {
    if (state.gainPct !== 100) applyGain();
  }, 2000);
  // Advertise a higher receive-bandwidth cap on video m-sections.
  const setVideoBitrate = (sdp, kbps) => {
    const out = [];
    let inVideo = false;
    for (const line of sdp.split('\r\n')) {
      if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
      if (inVideo && (line.startsWith('b=AS:') || line.startsWith('b=TIAS:'))) continue;
      out.push(line);
      if (inVideo && line.startsWith('c=')) {
        out.push('b=AS:' + kbps);
        out.push('b=TIAS:' + kbps * 1000);
      }
    }
    return out.join('\r\n');
  };
  const md = navigator.mediaDevices;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints) => {
    const stream = await orig(constraints);
    for (const t of stream.getAudioTracks()) {
      state.tracks.add(t);
      t.enabled = !state.muted;
      t.addEventListener('ended', () => state.tracks.delete(t));
    }
    return stream;
  };
  const RTC = window.RTCPeerConnection;
  if (RTC) {
    window.RTCPeerConnection = function (...args) {
      const pc = new RTC(...args);
      // Party chat connections are audio-only. Cloud-gaming streams carry
      // video on the same connection — their audio is GAME sound, not
      // voices, so it must not drive the party-activity light.
      const stops = new Set();
      let isGameStream = false;
      pc.addEventListener('track', (ev) => {
        if (ev.track.kind === 'video') {
          isGameStream = true;
          for (const stop of stops) stop();
          stops.clear();
          return;
        }
        if (ev.track.kind !== 'audio' || isGameStream) return;
        try {
          const ctx = window.__grCtx || (window.__grCtx = new AudioContext());
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const an = ctx.createAnalyser();
          an.fftSize = 256;
          ctx.createMediaStreamSource(new MediaStream([ev.track])).connect(an);
          const buf = new Uint8Array(an.frequencyBinCount);
          const timer = setInterval(() => {
            if (ev.track.readyState === 'ended') return clearInterval(timer);
            an.getByteTimeDomainData(buf);
            let peak = 0;
            for (const v of buf) {
              const d = Math.abs(v - 128);
              if (d > peak) peak = d;
            }
            state.remote = Math.max(state.remote, peak / 128);
          }, 150);
          stops.add(() => clearInterval(timer));
        } catch {}
      });
      return pc;
    };
    window.RTCPeerConnection.prototype = RTC.prototype;
    Object.setPrototypeOf(window.RTCPeerConnection, RTC);

    const origSLD = RTC.prototype.setLocalDescription;
    RTC.prototype.setLocalDescription = function (desc, ...rest) {
      try {
        if (state.kbps > 0 && desc && desc.sdp && desc.sdp.includes('m=video')) {
          desc = { type: desc.type, sdp: setVideoBitrate(desc.sdp, state.kbps) };
        }
      } catch {}
      return origSLD.call(this, desc, ...rest);
    };

    // Prefer better H.264 profiles: High (64) > Main (4d) > Baseline (42).
    // Xbox hands unknown browsers Constrained Baseline — worst quality per
    // bit, and the one profile hardware decoders commonly don't advertise,
    // which forces WebRTC onto FFmpeg software decode. If the server only
    // offers Baseline, the answer is unchanged (zero regression).
    const profileRank = (c) => {
      if (!/video\/h264/i.test(c.mimeType)) return 1;
      const m = /profile-level-id=([0-9a-fA-F]{2})/.exec(c.sdpFmtpLine || '');
      const prof = m ? m[1].toLowerCase() : '';
      if (prof === '64') return -2; // High
      if (prof === '4d') return -1; // Main
      return 2; // Baseline & friends last
    };
    const origCreateAnswer = RTC.prototype.createAnswer;
    RTC.prototype.createAnswer = function (...a) {
      try {
        const caps = RTCRtpReceiver.getCapabilities('video');
        if (caps && caps.codecs && caps.codecs.length) {
          const sorted = [...caps.codecs].sort(
            (x, y) => profileRank(x) - profileRank(y)
          );
          for (const t of this.getTransceivers()) {
            const kind =
              (t.receiver && t.receiver.track && t.receiver.track.kind) ||
              null;
            if (kind === 'video' && t.setCodecPreferences) {
              try {
                t.setCodecPreferences(sorted);
              } catch {}
            }
          }
        }
      } catch {}
      return origCreateAnswer.apply(this, a);
    };
  }
})();`;

const bitrateKbps = () => (config.get().streamBitrateMbps | 0) * 1000;

function inject(contents) {
  return contents
    .executeJavaScript(
      INJECT.replace('__GR_MUTED__', String(muted))
        .replace('__GR_KBPS__', String(bitrateKbps()))
        .replace('__GR_GAIN__', String(config.get().gameVolume | 0))
    )
    .catch(() => {});
}

// Called when the setting changes; affects the next stream negotiation.
function applyBitrate() {
  if (xboxContents && !xboxContents.isDestroyed()) {
    xboxContents
      .executeJavaScript(
        `window.__grMic && window.__grMic.setKbps(${bitrateKbps()})`
      )
      .catch(() => {});
  }
}

// Called when the volume setting changes; applies to the live stream.
function applyGain() {
  if (xboxContents && !xboxContents.isDestroyed()) {
    xboxContents
      .executeJavaScript(
        `window.__grMic && window.__grMic.setGain(${config.get().gameVolume | 0})`
      )
      .catch(() => {});
  }
}

// Called from main.js when the Xbox webview's webContents appears.
function attach(contents) {
  xboxContents = contents;
  contents.on('dom-ready', () => inject(contents));
  contents.on('destroyed', () => {
    if (xboxContents === contents) xboxContents = null;
  });
  if (!contents.isLoading()) inject(contents);
}

// Integrity: mute state lives in the page's world, where page scripts could
// theoretically re-enable tracks behind our back. While muted, re-assert
// silence every 10s so the tray icon can never lie about the mic.
setInterval(() => {
  if (muted && xboxContents && !xboxContents.isDestroyed()) {
    xboxContents
      .executeJavaScript('window.__grMic && window.__grMic.setMuted(true)')
      .catch(() => {});
  }
}, 10_000);

async function setMuted(m) {
  muted = !!m;
  if (xboxContents && !xboxContents.isDestroyed()) {
    await xboxContents
      .executeJavaScript(`window.__grMic && window.__grMic.setMuted(${muted})`)
      .catch(() => {});
  }
  for (const cb of listeners) cb(muted);
  return muted;
}

// Polled by main (fast while the HUD is visible; slow for the 🎮 indicator).
async function getStatus() {
  let remote = 0;
  let pads = 0;
  if (xboxContents && !xboxContents.isDestroyed()) {
    try {
      [remote, pads] = await xboxContents.executeJavaScript(
        'window.__grMic ? [window.__grMic.remoteLevel(), window.__grMic.pads()] : [0, 0]'
      );
    } catch {}
  }
  return { muted, remote: Number(remote) || 0, pads: Number(pads) || 0 };
}

const toggle = () => setMuted(!muted);
const isMuted = () => muted;
const onChange = (cb) => listeners.add(cb);

module.exports = {
  attach,
  setMuted,
  toggle,
  isMuted,
  onChange,
  getStatus,
  applyBitrate,
  applyGain,
};
