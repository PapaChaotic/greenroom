const view = document.getElementById('view');
const loading = document.getElementById('loading');
const HOME = 'https://www.xbox.com/play';

// --- Window controls ---
document.getElementById('win-min').onclick = () => window.greenroom.minimize();
document.getElementById('win-max').onclick = () => window.greenroom.maximize();
document.getElementById('win-close').onclick = () => window.greenroom.close();

const maxBtn = document.getElementById('win-max');
window.greenroom.onMaximized((isMax) => {
  maxBtn.textContent = isMax ? '❐' : '▢';
  maxBtn.title = isMax ? 'Restore' : 'Maximize';
});

// --- Navigation ---
document.getElementById('nav-back').onclick = () => {
  if (view.canGoBack()) view.goBack();
};
document.getElementById('nav-forward').onclick = () => {
  if (view.canGoForward()) view.goForward();
};
document.getElementById('nav-reload').onclick = () => view.reload();
document.getElementById('nav-home').onclick = () => (view.src = HOME);

// --- Mic toggle + state ---
const micBtn = document.getElementById('mic-btn');
function renderMic(muted) {
  micBtn.textContent = muted ? '🔇' : '🎙';
  micBtn.classList.toggle('muted', muted);
  micBtn.title = muted ? 'Mic muted — click to unmute' : 'Mic live — click to mute';
}
micBtn.onclick = async () => renderMic(await window.greenroom.toggleMic());
window.greenroom.onMicState(renderMic);
window.greenroom.getMic().then(renderMic);

// --- Settings ---
document.getElementById('settings-btn').onclick = () =>
  window.greenroom.openSettings();

// --- Hotkey status (Wayland fallback notice) ---
const note = document.getElementById('hotkey-note');
window.greenroom.onHotkeyStatus(({ failed }) => {
  if (failed.length === 0) return;
  note.textContent =
    'Global hotkeys unavailable on this desktop (Wayland without the ' +
    'GlobalShortcuts portal). Hotkeys still work while GreenRoom is focused.';
  note.classList.remove('hidden');
  setTimeout(() => note.classList.add('hidden'), 10_000);
});

// --- Loading overlay ---
view.addEventListener('did-start-loading', () => {
  loading.classList.remove('hidden');
});
view.addEventListener('did-stop-loading', () => {
  loading.classList.add('hidden');
});
view.addEventListener('did-fail-load', (e) => {
  // -3 is ERR_ABORTED (normal during redirects); ignore it.
  if (e.errorCode !== -3) {
    loading.querySelector('p').textContent =
      `Couldn't load Xbox (${e.errorCode}). Check your connection and reload.`;
  }
});
