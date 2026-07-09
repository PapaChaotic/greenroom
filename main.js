const { app, BrowserWindow, ipcMain } = require('electron');

const config = require('./src/config');
const security = require('./src/security');
const windows = require('./src/windows');
const tray = require('./src/tray');
const hotkeys = require('./src/hotkeys');
const ptt = require('./src/ptt');
const updater = require('./src/updater');
const crash = require('./src/crash');

const pkg = require('./package.json');
const REPO_URL = pkg.homepage;

// One combined list — appendSwitch replaces (not merges) repeated keys.
// - GlobalShortcutsPortal: Wayland global hotkeys via the desktop portal
//   (KDE; GNOME 48+).
// - AcceleratedVideoDecodeLinuxGL: hardware (VA-API) video decode, which
//   Linux Chromium leaves OFF by default. Without it the CPU software-decodes
//   the cloud-gaming stream (~13ms/frame at 1440p); the stall reads as
//   latency to xCloud, which slashes the bitrate — worst in fullscreen.
app.commandLine.appendSwitch(
  'enable-features',
  'GlobalShortcutsPortal,AcceleratedVideoDecodeLinuxGL'
);

// Chromium's Vulkan path is incompatible with native Wayland and aborts the
// whole process under heavy GPU load (cloud-gaming video decode). Chromium
// logs this exact advice at startup; take it. GL/ANGLE handles rendering.
app.commandLine.appendSwitch('disable-features', 'Vulkan');

// Tray apps must be single-instance: a second launch signals the first.
// That also gives us a hotkey fallback that works on EVERY desktop: bind a
// system shortcut to `greenroom --hud` (or --mic) and it controls the
// running instance.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--hud')) actions.gameBar();
    else if (argv.includes('--mic')) actions.toggleMic();
    else windows.show();
  });
}

let quitting = false;
let xboxContents = null;
let updaterApi = { check: () => {} };

// --- Hotkey actions (shared by globals, in-app fallback, tray, titlebar) ---
const actions = {
  toggleMic: async () => {
    const muted = await ptt.toggle();
    tray.setMicState(muted, config.get());
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('mic:state', muted);
    }
  },
  gameBar: () => windows.toggleHud(),
};

function applyHotkeys() {
  const results = hotkeys.applyGlobal(config.get(), actions);
  // Tell the shell if global registration failed (Wayland without portal) so
  // the user learns hotkeys are focus-only rather than discovering it midgame.
  const failed = Object.entries(results)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  windows.getMain()?.webContents.send('hotkeys:status', { failed });
}

// --- IPC (validated: window-control senders must be our shell windows) ---
function registerIpc() {
  const senderWindow = (event) => BrowserWindow.fromWebContents(event.sender);
  const fromShell = (event) => {
    const win = senderWindow(event);
    return win && event.sender === win.webContents ? win : null;
  };

  ipcMain.on('win:minimize', (e) => fromShell(e)?.minimize());
  ipcMain.on('win:maximize', (e) => {
    const win = fromShell(e);
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('win:close', (e) => fromShell(e)?.close());

  ipcMain.handle('mic:toggle', (e) =>
    fromShell(e) ? actions.toggleMic().then(() => ptt.isMuted()) : ptt.isMuted()
  );
  ipcMain.handle('mic:get', () => ptt.isMuted());

  ipcMain.handle('settings:get', () => ({
    settings: config.get(),
    version: app.getVersion(),
    electron: process.versions.electron,
  }));
  ipcMain.handle('settings:set', (e, patch) => {
    if (!fromShell(e)) return config.get();
    const next = config.set(patch); // config.js sanitizes the patch
    applyHotkeys();
    tray.refresh(next);
    windows.applyScale(next, xboxContents);
    ptt.applyBitrate();
    return next;
  });
  ipcMain.handle('settings:testAccelerator', (e, accel) =>
    fromShell(e) && typeof accel === 'string'
      ? hotkeys.testAccelerator(accel)
      : { valid: false, global: false }
  );
  ipcMain.on('settings:open', (e) => {
    if (fromShell(e)) windows.openSettings();
  });
  ipcMain.on('updates:check', (e) => {
    if (fromShell(e)) updaterApi.check({ manual: true });
  });
  ipcMain.on('hud:hide', (e) => {
    if (fromShell(e)) windows.hideHud();
  });
  ipcMain.on('hud:open', (e) => {
    if (fromShell(e)) {
      windows.hideHud();
      windows.show();
    }
  });
}

// Stream mic + party-audio status to the HUD while it's visible.
function startHudFeed() {
  setInterval(async () => {
    if (!windows.isHudVisible()) return;
    const status = await ptt.getStatus();
    windows.getHud()?.webContents.send('hud:status', status);
  }, 300);
}

// --- Per-webContents hardening + feature wiring -----------------------------
app.on('web-contents-created', (_event, contents) => {
  security.hardenContents(contents);

  if (contents.getType() === 'webview') {
    // This is the Xbox webview: wire up push-to-talk and scaling.
    xboxContents = contents;
    ptt.attach(contents);
    contents.on('dom-ready', () =>
      windows.applyScale(config.get(), contents)
    );
  }

  // In-app hotkey fallback works on every window, even without the portal.
  hotkeys.attachFallback(contents, config.get, actions);
});

// Close-to-tray: the party keeps running in the background.
const mainWindowOpts = {
  onClose: (event, win) => {
    if (!quitting && config.get().closeToTray) {
      event.preventDefault();
      win.hide();
    }
  },
};

// --- Lifecycle ---------------------------------------------------------------
app.whenReady().then(() => {
  crash.init(REPO_URL);
  security.configureSession();
  registerIpc();

  windows.createMain(config.get(), mainWindowOpts);

  tray.create(config.get(), {
    show: () => windows.show(),
    toggleMic: () => actions.toggleMic(),
    toggleGameBar: () => actions.gameBar(),
    openSettings: () => windows.openSettings(),
    checkUpdates: () => updaterApi.check({ manual: true }),
    applyUpdate: () => updaterApi.promptPending(),
    quit: () => {
      quitting = true;
      app.quit();
    },
  });

  applyHotkeys();
  startHudFeed();
  ptt.onChange((muted) => tray.setMicState(muted, config.get()));

  updaterApi = updater.init({
    windowGetter: () => windows.getMain(),
    config: config.get(),
    repositoryUrl: REPO_URL,
    // Background-found updates surface passively: tray item + in-app notice.
    onUpdateAvailable: (info) => {
      tray.setUpdateAvailable(info.version, config.get());
      windows.getMain()?.webContents.send('update:available', info.version);
    },
  });

  // CI smoke test: prove the app boots and the shell renders, then exit.
  if (process.env.GR_SMOKE === '1') {
    const timeout = setTimeout(() => {
      console.error('SMOKE FAIL: shell did not load in 45s');
      app.exit(1);
    }, 45_000);
    windows.getMain().webContents.once('did-finish-load', () => {
      clearTimeout(timeout);
      console.log('SMOKE OK');
      quitting = true;
      app.exit(0);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windows.createMain(config.get(), { onClose: () => {} });
    } else {
      windows.show();
    }
  });
});

app.on('before-quit', () => (quitting = true));

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  // With close-to-tray on, a user-initiated close only HIDES the window — so
  // reaching this state means the window was DESTROYED out from under us
  // (e.g. a compositor kill during heavy GPU load). Resurrect instead of
  // dying: the app stays in the tray and reloads Xbox.
  if (!quitting && config.get().closeToTray) {
    windows.createMain(config.get(), mainWindowOpts);
  } else {
    app.quit();
  }
});
