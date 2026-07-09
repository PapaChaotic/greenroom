const mic = document.getElementById('mic');
const activity = document.getElementById('activity');

function renderMic(muted) {
  mic.textContent = muted ? '🔇' : '🎙';
  mic.classList.toggle('muted', muted);
}

mic.onclick = async () => renderMic(await window.greenroom.toggleMic());
document.getElementById('open').onclick = () => window.greenroom.hudOpenApp();
document.getElementById('hide').onclick = () => window.greenroom.hudHide();

// Pin: while active, clicking outside the HUD no longer dismisses it.
const pin = document.getElementById('pin');
let pinned = false;
function renderPin(p) {
  pinned = p;
  pin.classList.toggle('pinned', p);
  pin.title = p
    ? 'Pinned — click to unpin (click-out will dismiss again)'
    : 'Pin — stay open when clicking elsewhere';
}
pin.onclick = async () => {
  const next = await window.greenroom.setSettings({ hudPinned: !pinned });
  renderPin(next.hudPinned);
};
window.greenroom
  .getSettings()
  .then(({ settings }) => renderPin(settings.hudPinned));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.greenroom.hudHide();
});

window.greenroom.onMicState(renderMic);
window.greenroom.getMic().then(renderMic);

// Party audio activity light: main polls the Xbox page for inbound WebRTC
// audio level and streams it here while the HUD is visible.
window.greenroom.onHudStatus(({ muted, remote }) => {
  renderMic(muted);
  activity.classList.toggle('live', remote > 0.05);
});
