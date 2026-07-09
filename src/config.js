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
  // Cloud-gaming stream bitrate ceiling in Mbps (0 = Xbox's default profile,
  // which is starved for unknown browsers). The server still adapts down.
  streamBitrateMbps: 25,
  // 'hardware' decodes the stream on the GPU (required for 60 fps);
  // 'software' is the CPU compatibility path. Applied at app startup.
  videoDecode: 'hardware',
  // Game-stream audio boost, percent (100 = untouched native path).
  gameVolume: 100,
};

const VALID_BITRATES = new Set([0, 8, 15, 25, 40]);
const VALID_DECODE = new Set(['hardware', 'software']);
const validVolume = (v) =>
  Number.isInteger(v) && v >= 100 && v <= 300 && v % 25 === 0;

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
  if (VALID_BITRATES.has(raw.streamBitrateMbps))
    out.streamBitrateMbps = raw.streamBitrateMbps;
  if (VALID_DECODE.has(raw.videoDecode)) out.videoDecode = raw.videoDecode;
  if (validVolume(raw.gameVolume)) out.gameVolume = raw.gameVolume;
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
