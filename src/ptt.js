// Push-to-talk / mic toggle. We wrap navigator.mediaDevices.getUserMedia in
// the Xbox page so every audio track it ever captures is registered with us;
// muting flips `track.enabled` at the source. This works no matter how Xbox's
// own UI changes, and when muted the page receives pure silence.
let xboxContents = null;
let muted = false;
const listeners = new Set();

const INJECT = `(() => {
  if (window.__grMic) return;
  const state = { tracks: new Set(), muted: ${'${MUTED}'} };
  window.__grMic = {
    setMuted(m) {
      state.muted = !!m;
      for (const t of state.tracks) t.enabled = !state.muted;
      return state.muted;
    },
    isMuted: () => state.muted,
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
})();`;

function inject(contents) {
  return contents
    .executeJavaScript(INJECT.replace('${MUTED}', String(muted)))
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

const toggle = () => setMuted(!muted);
const isMuted = () => muted;
const onChange = (cb) => listeners.add(cb);

module.exports = { attach, setMuted, toggle, isMuted, onChange };
