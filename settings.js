const $ = (id) => document.getElementById(id);
const status = $('status');

let settings = null;

function flash(msg) {
  status.textContent = msg;
  setTimeout(() => {
    if (status.textContent === msg) status.textContent = '';
  }, 4000);
}

async function save(patch) {
  settings = await window.greenroom.setSettings(patch);
  flash('Saved.');
  render();
}

function render() {
  $('hk-mic').value = settings.hotkeys.toggleMic || '';
  $('hk-gamebar').value = settings.hotkeys.gameBar || '';
  $('ui-scale').value = String(settings.uiScale);
  $('stream-bitrate').value = String(settings.streamBitrateMbps);
  $('video-decode').value = settings.videoDecode;
  $('game-volume').value = String(settings.gameVolume);
  $('vol-label').textContent = settings.gameVolume + '%';
  $('close-tray').checked = settings.closeToTray;
  $('hud-hides-app').checked = settings.hudHidesApp;
  $('check-updates').checked = settings.checkUpdates;
}

// --- Hotkey capture: click the field, press a combo, Esc clears ---
function accelFromEvent(e) {
  const mods = [];
  if (e.ctrlKey) mods.push('Control');
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');
  if (e.metaKey) mods.push('Super');
  let key = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta', 'Super'].includes(key)) return null;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  if (mods.length === 0) return null; // require at least one modifier
  return [...mods, key].join('+');
}

function captureInto(inputId, settingKey) {
  const input = $(inputId);
  input.addEventListener('focus', () => {
    input.classList.add('recording');
    input.value = 'Press a key combo…';
  });
  input.addEventListener('blur', () => {
    input.classList.remove('recording');
    render();
  });
  input.addEventListener('keydown', async (e) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      await save({ hotkeys: { [settingKey]: '' } });
      input.blur();
      return;
    }
    const accel = accelFromEvent(e);
    if (!accel) return; // modifier-only or missing modifier — keep waiting
    const test = await window.greenroom.testAccelerator(accel);
    if (!test.valid) {
      flash(`"${accel}" isn't a usable shortcut.`);
      return;
    }
    await save({ hotkeys: { [settingKey]: accel } });
    if (!test.global) {
      flash(`Saved. Note: works while GreenRoom is focused (Wayland).`);
    }
    input.blur();
  });
}

captureInto('hk-mic', 'toggleMic');
captureInto('hk-gamebar', 'gameBar');

$('ui-scale').addEventListener('change', (e) => {
  const v = e.target.value;
  save({ uiScale: v === 'auto' ? 'auto' : Number(v) });
});
$('stream-bitrate').addEventListener('change', (e) =>
  save({ streamBitrateMbps: Number(e.target.value) })
);
$('video-decode').addEventListener('change', (e) => {
  save({ videoDecode: e.target.value });
  flash('Saved — restart GreenRoom to apply.');
});
$('game-volume').addEventListener('input', (e) => {
  $('vol-label').textContent = e.target.value + '%';
});
$('game-volume').addEventListener('change', (e) =>
  save({ gameVolume: Number(e.target.value) })
);
$('close-tray').addEventListener('change', (e) =>
  save({ closeToTray: e.target.checked })
);
$('hud-hides-app').addEventListener('change', (e) =>
  save({ hudHidesApp: e.target.checked })
);
$('check-updates').addEventListener('change', (e) =>
  save({ checkUpdates: e.target.checked })
);
$('check-now').addEventListener('click', () => {
  window.greenroom.checkUpdates();
  flash('Checking…');
});

window.greenroom.getSettings().then((data) => {
  settings = data.settings;
  $('about-version').textContent =
    `GreenRoom ${data.version} (beta) · Electron ${data.electron}`;
  render();
});
