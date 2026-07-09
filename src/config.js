// Persistent user settings, stored as JSON in Electron's userData directory.
// Only known keys are accepted; unknown/malformed input is dropped on load
// and on set, so a corrupted or tampered settings file can't inject state.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  hotkeys: {
    toggleMic: 'Control+Shift+M', // push-to-talk style mic toggle
    gameBar: 'Control+Shift+G', // compact always-on-top "Game Bar" view
  },
  // 'auto' picks a scale from the display size (Steam Deck => 1.25).
  uiScale: 'auto',
  checkUpdates: true,
  closeToTray: true,
  hudPinned: false, // pinned HUD ignores click-out dismissal
  hudHidesApp: true, // summoning the HUD sends the main window to the tray
};

const VALID_SCALES = new Set(['auto', 1, 1.25, 1.5]);
// Electron accelerator: modifiers + key code, e.g. "Control+Shift+M".
const ACCEL_RE =
  /^((Control|Ctrl|Shift|Alt|Super|Meta|CommandOrControl)\+)*[A-Za-z0-9]([A-Za-z0-9]*|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)?$/;

let cached = null;
const listeners = new Set();

function file() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitize(raw) {
  const out = structuredClone(DEFAULTS);
  if (!raw || typeof raw !== 'object') return out;

  if (raw.hotkeys && typeof raw.hotkeys === 'object') {
    for (const key of Object.keys(DEFAULTS.hotkeys)) {
      const v = raw.hotkeys[key];
      if (v === '' || (typeof v === 'string' && ACCEL_RE.test(v))) {
        out.hotkeys[key] = v;
      }
    }
  }
  if (VALID_SCALES.has(raw.uiScale)) out.uiScale = raw.uiScale;
  if (typeof raw.checkUpdates === 'boolean') out.checkUpdates = raw.checkUpdates;
  if (typeof raw.closeToTray === 'boolean') out.closeToTray = raw.closeToTray;
  if (typeof raw.hudPinned === 'boolean') out.hudPinned = raw.hudPinned;
  if (typeof raw.hudHidesApp === 'boolean') out.hudHidesApp = raw.hudHidesApp;
  return out;
}

function get() {
  if (!cached) {
    try {
      cached = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8')));
    } catch {
      cached = structuredClone(DEFAULTS);
    }
  }
  return cached;
}

function set(patch) {
  cached = sanitize({
    ...get(),
    ...patch,
    hotkeys: { ...get().hotkeys, ...(patch?.hotkeys ?? {}) },
  });
  try {
    fs.writeFileSync(file(), JSON.stringify(cached, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('settings save failed:', err.message);
  }
  for (const cb of listeners) cb(cached);
  return cached;
}

function onChange(cb) {
  listeners.add(cb);
}

module.exports = { get, set, onChange, DEFAULTS };
