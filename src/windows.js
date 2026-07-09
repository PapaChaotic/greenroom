const { BrowserWindow, screen } = require('electron');
const path = require('path');

let main = null;
let settings = null;
let gameBar = false;
let savedBounds = null;

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

// Compact always-on-top "Game Bar" view: small pinned panel for mid-game use.
function toggleGameBar() {
  if (!main || main.isDestroyed()) return gameBar;
  gameBar = !gameBar;
  if (gameBar) {
    savedBounds = main.getBounds();
    if (main.isMaximized()) main.unmaximize();
    const { workArea } = screen.getPrimaryDisplay();
    main.setAlwaysOnTop(true, 'screen-saver');
    main.setBounds({
      x: workArea.x + workArea.width - 440,
      y: workArea.y + 20,
      width: 420,
      height: 640,
    });
    main.show();
  } else {
    main.setAlwaysOnTop(false);
    if (savedBounds) main.setBounds(savedBounds);
  }
  main.webContents.send('ui:compact', gameBar);
  return gameBar;
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

function show() {
  if (!main || main.isDestroyed()) return;
  main.show();
  main.focus();
}

const getMain = () => (main && !main.isDestroyed() ? main : null);
const isGameBar = () => gameBar;

module.exports = {
  createMain,
  toggleGameBar,
  openSettings,
  applyScale,
  resolveScale,
  show,
  getMain,
  isGameBar,
};
