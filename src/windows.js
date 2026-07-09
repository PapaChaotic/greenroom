const { BrowserWindow, screen } = require('electron');
const path = require('path');
const config = require('./config');

let main = null;
let settings = null;
let hud = null;

// Steam Deck (and similar handhelds) report a 1280x800 panel; bump the UI.
function autoScale() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return width <= 1280 && height <= 800 ? 1.25 : 1;
}

function resolveScale(config) {
  return config.uiScale === 'auto' ? autoScale() : config.uiScale;
}

function applyScale(config, xboxContents) {
  const z = resolveScale(config);
  if (main && !main.isDestroyed()) main.webContents.setZoomFactor(z);
  if (xboxContents && !xboxContents.isDestroyed())
    xboxContents.setZoomFactor(z);
}

function createMain(config, { onClose }) {
  const deck = autoScale() > 1;
  main = new BrowserWindow({
    // On a 1280x800 Deck panel, open fitted to the screen instead of 1200x800.
    width: deck ? 1280 : 1200,
    height: deck ? 800 : 800,
    minWidth: 640,
    minHeight: 480,
    frame: false, // custom Game Bar-style titlebar in the renderer
    backgroundColor: '#0b0f0b',
    title: 'GreenRoom',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: true,
    },
  });

  main.loadFile('index.html');

  // The shell window only ever shows our local UI — block all navigation.
  main.webContents.on('will-navigate', (event) => event.preventDefault());

  const emitMaxState = () =>
    main.webContents.send('win:maximized', main.isMaximized());
  main.on('maximize', emitMaxState);
  main.on('unmaximize', emitMaxState);

  main.on('close', (event) => onClose(event, main));
  main.on('closed', () => (main = null));
  return main;
}

// --- Game Bar HUD ------------------------------------------------------------
// A small, slightly transparent pill of party essentials (mic toggle, party
// audio light, open app) that the hotkey summons over your game. Esc or
// clicking away hides it; the party keeps running in the background.

function createHud() {
  hud = new BrowserWindow({
    width: 296,
    height: 64,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
    show: false,
    title: 'GreenRoom HUD',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  hud.loadFile('hud.html');
  hud.webContents.on('will-navigate', (e) => e.preventDefault());
  hud.setAlwaysOnTop(true, 'screen-saver');
  hud.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-out dismissal (focus moving to one of our own windows doesn't
  // count, and a pinned HUD stays put until Esc, ✕, or the hotkey).
  hud.on('blur', () => {
    if (config.get().hudPinned) return;
    if (hud?.isVisible() && !BrowserWindow.getFocusedWindow()) hideHud();
  });
  hud.on('closed', () => (hud = null));
  return hud;
}

function showHud() {
  if (!hud || hud.isDestroyed()) createHud();
  // Game Bar semantics: the HUD replaces the app — the full window goes to
  // the tray so only the pill floats over your game. Optional in Settings
  // for people who want both up.
  if (
    config.get().hudHidesApp &&
    main &&
    !main.isDestroyed() &&
    main.isVisible()
  ) {
    main.hide();
  }
  const { workArea } = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  hud.setPosition(workArea.x + workArea.width - 296 - 16, workArea.y + 16);
  hud.show();
  hud.focus();
}

function hideHud() {
  if (hud && !hud.isDestroyed()) hud.hide();
}

function toggleHud() {
  if (hud && !hud.isDestroyed() && hud.isVisible()) hideHud();
  else showHud();
}

const isHudVisible = () =>
  !!(hud && !hud.isDestroyed() && hud.isVisible());
const getHud = () => (hud && !hud.isDestroyed() ? hud : null);

function openSettings() {
  if (settings && !settings.isDestroyed()) {
    settings.focus();
    return settings;
  }
  settings = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    title: 'GreenRoom Settings',
    parent: main ?? undefined,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f0b',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settings.loadFile('settings.html');
  settings.webContents.on('will-navigate', (e) => e.preventDefault());
  settings.on('closed', () => (settings = null));
  return settings;
}

function show() {
  if (!main || main.isDestroyed()) return;
  main.show();
  main.focus();
}

const getMain = () => (main && !main.isDestroyed() ? main : null);

module.exports = {
  createMain,
  toggleHud,
  hideHud,
  isHudVisible,
  getHud,
  openSettings,
  applyScale,
  resolveScale,
  show,
  getMain,
};
