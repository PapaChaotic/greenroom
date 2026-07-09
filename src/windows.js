const { BrowserWindow, screen } = require('electron');
const path = require('path');

let main = null;
let settings = null;
let overlay = false;
let savedNormal = null; // window geometry to restore after overlay mode

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

  // Click-out dismissal: losing focus to anything that isn't one of our own
  // windows (settings, dialogs) closes the overlay, like Xbox Game Bar.
  main.on('blur', () => {
    if (overlay && !BrowserWindow.getFocusedWindow()) exitOverlay();
  });

  return main;
}

// --- Game Bar overlay -------------------------------------------------------
// The hotkey SUMMONS the app as a pinned panel over whatever you're doing —
// even while GreenRoom sits hidden in the tray. Esc or clicking away
// dismisses it back to the tray; the party keeps running either way.

function enterOverlay() {
  if (!main || main.isDestroyed()) return;
  if (!overlay) {
    savedNormal = { bounds: main.getBounds(), maximized: main.isMaximized() };
    if (main.isMaximized()) main.unmaximize();
  }
  overlay = true;
  const { workArea } = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  const width = 420;
  const height = Math.min(720, workArea.height - 32);
  main.setSkipTaskbar(true);
  main.setAlwaysOnTop(true, 'screen-saver');
  main.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  main.setBounds({
    x: workArea.x + workArea.width - width - 16,
    y: workArea.y + 16,
    width,
    height,
  });
  main.show();
  main.focus();
  main.webContents.send('ui:overlay', true);
}

function exitOverlay({ hide = true } = {}) {
  if (!main || main.isDestroyed() || !overlay) return;
  overlay = false;
  main.setAlwaysOnTop(false);
  main.setVisibleOnAllWorkspaces(false);
  main.setSkipTaskbar(false);
  if (savedNormal) {
    main.setBounds(savedNormal.bounds);
    if (savedNormal.maximized) main.maximize();
  }
  main.webContents.send('ui:overlay', false);
  if (hide) main.hide();
}

function toggleOverlay() {
  if (overlay && main?.isVisible()) exitOverlay();
  else enterOverlay();
}

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

// Normal "show the app" path (tray click, second launch): always leaves
// overlay mode so the user gets their regular window back.
function show() {
  if (!main || main.isDestroyed()) return;
  exitOverlay({ hide: false });
  main.show();
  main.focus();
}

const getMain = () => (main && !main.isDestroyed() ? main : null);
const isOverlay = () => overlay;

module.exports = {
  createMain,
  toggleOverlay,
  exitOverlay,
  openSettings,
  applyScale,
  resolveScale,
  show,
  getMain,
  isOverlay,
};
