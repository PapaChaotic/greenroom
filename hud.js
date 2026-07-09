const mic = document.getElementById('mic');
const activity = document.getElementById('activity');

function renderMic(muted) {
  mic.textContent = muted ? '🔇' : '🎙';
  mic.classList.toggle('muted', muted);
}

mic.onclick = async () => renderMic(await window.greenroom.toggleMic());
document.getElementById('open').onclick = () => window.greenroom.hudOpenApp();
document.getElementById('hide').onclick = () => window.greenroom.hudHide();

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
