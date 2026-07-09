// Push-to-talk / mic toggle + party audio sensing.
//
// We wrap navigator.mediaDevices.getUserMedia in the Xbox page so every audio
// track it captures is registered with us; muting flips `track.enabled` at
// the source — the page receives pure silence no matter what its UI does.
//
// We also wrap RTCPeerConnection to run inbound (party) audio through an
// AnalyserNode, giving the HUD a "party audio activity" level without ever
// touching Microsoft's obfuscated UI internals.
let xboxContents = null;
let muted = false;
const listeners = new Set();

const INJECT = String.raw`(() => {
  if (window.__grMic) return;
  const state = { tracks: new Set(), muted: __GR_MUTED__, remote: 0 };
  window.__grMic = {
    setMuted(m) {
      state.muted = !!m;
      for (const t of state.tracks) t.enabled = !state.muted;
      return state.muted;
    },
    isMuted: () => state.muted,
    // Peak inbound level since last read (decays so the light goes out).
    remoteLevel() { const v = state.remote; state.remote *= 0.5; return v; },
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
      pc.addEventListener('track', (ev) => {
        if (ev.track.kind !== 'audio') return;
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
        } catch {}
      });
      return pc;
    };
    window.RTCPeerConnection.prototype = RTC.prototype;
    Object.setPrototypeOf(window.RTCPeerConnection, RTC);
  }
})();`;

function inject(contents) {
  return contents
    .executeJavaScript(INJECT.replace('__GR_MUTED__', String(muted)))
    .catch(() => {});
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

// Polled by main while the HUD is visible.
async function getStatus() {
  let remote = 0;
  if (xboxContents && !xboxContents.isDestroyed()) {
    try {
      remote = await xboxContents.executeJavaScript(
        'window.__grMic && window.__grMic.remoteLevel ? window.__grMic.remoteLevel() : 0'
      );
    } catch {}
  }
  return { muted, remote: Number(remote) || 0 };
}

const toggle = () => setMuted(!muted);
const isMuted = () => muted;
const onChange = (cb) => listeners.add(cb);

module.exports = { attach, setMuted, toggle, isMuted, onChange, getStatus };
