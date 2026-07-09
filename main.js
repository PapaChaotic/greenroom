const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');

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
// - Hardware (VA-API) video decode, which Linux Chromium leaves OFF by
//   default: without it the CPU software-decodes the cloud-gaming stream
//   (~13ms/frame at 1440p) and can never sustain 60 fps. GPU decode is the
//   default; Settings offers the CPU path for buggy-driver setups.
//   VaapiIgnoreDriverChecks lets the NVIDIA VA-API shim through Chromium's
//   allowlist (still needs the system package, e.g. libva-nvidia-driver).
const enableFeatures = ['GlobalShortcutsPortal'];
const nvidiaHwDecode =
  config.get().videoDecode !== 'software' &&
  fs.existsSync('/proc/driver/nvidia/version');
if (config.get().videoDecode !== 'software') {
  enableFeatures.push(
    'AcceleratedVideoDecodeLinuxGL',
    'VaapiIgnoreDriverChecks'
  );
}
if (nvidiaHwDecode) {
  // The NVIDIA VA-API shim must initialize CUDA inside the GPU process,
  // which Chromium's GPU-process sandbox forbids — this is the documented
  // Chromium limitation of nvidia-vaapi-driver. Relax ONLY that sandbox
  // (renderers, the Xbox webview, and shell windows stay fully sandboxed;
  // the navigation allowlist still controls what reaches the decoder).
  // Users can keep the GPU sandbox by choosing Software decoding.
  // Documented in SECURITY.md.
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}
app.commandLine.appendSwitch('enable-features', enableFeatures.join(','));

// NVIDIA hardware decode needs LIBVA_DRIVER_NAME in the environment BEFORE
// Chromium forks its zygote — earlier than any of this JavaScript runs, so
// setting process.env here never reaches the GPU process. Respawn once with
// an EXPLICIT env (app.relaunch() does not carry runtime env changes — that
// way lies an infinite loop). Guarded by GR_VAAPI_RELAUNCH; skipped in smoke
// tests and when the user exported the variable themselves.
const bootLog = (msg) => {
  try {
    const f = require('path').join(app.getPath('userData'), 'boot.log');
    try {
      if (fs.statSync(f).size > 65536) fs.unlinkSync(f); // simple rotation
    } catch {}
    fs.appendFileSync(
      f,
      `${new Date().toISOString()} pid=${process.pid} ${msg}\n`,
      { mode: 0o600 }
    );
  } catch {}
};
bootLog(
  `boot decode=${config.get().videoDecode} nvidia=${fs.existsSync('/proc/driver/nvidia/version')} ` +
    `libva=${process.env.LIBVA_DRIVER_NAME || 'unset'} relaunch=${process.env.GR_VAAPI_RELAUNCH || 'unset'} ` +
    `smoke=${process.env.GR_SMOKE || 'unset'} appimage=${!!process.env.APPIMAGE}`
);

if (
  config.get().videoDecode !== 'software' &&
  fs.existsSync('/proc/driver/nvidia/version') &&
  !process.env.LIBVA_DRIVER_NAME &&
  process.env.GR_VAAPI_RELAUNCH !== '1' &&
  process.env.GR_SMOKE !== '1'
) {
  bootLog('respawning with LIBVA_DRIVER_NAME=nvidia');
  const { spawn } = require('child_process');
  // Relaunch the AppImage itself when packaged (the /tmp mount dies with
  // this process); the electron binary + args in dev.
  const exe = process.env.APPIMAGE || process.execPath;
  const args = process.env.APPIMAGE ? [] : process.argv.slice(1);
  spawn(exe, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      LIBVA_DRIVER_NAME: 'nvidia',
      GR_VAAPI_RELAUNCH: '1',
    },
  }).unref();
  app.exit(0);
}

// Chromium's Vulkan path is incompatible with native Wayland and aborts the
// whole process under heavy GPU load (cloud-gaming video decode). Chromium
// logs this exact advice at startup; take it. GL/ANGLE handles rendering.
app.commandLine.appendSwitch('disable-features', 'Vulkan');

// Tray apps must be single-instance: a second launch signals the first.
// That also gives us a hotkey fallback that works on EVERY desktop: bind a
// system shortcut to `greenroom --hud` (or --mic) and it controls the
// running instance. A secondary instance must do NOTHING else — no crash
// sentinel, no whenReady setup — or it corrupts the primary's state.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
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
    ptt.applyGain();
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
  // Slow always-on poll: two-stage controller indicator for the titlebar.
  // `os` = the controller is physically connected (read from the kernel);
  // `page` = the Xbox page can actually use it (Chromium only exposes
  // gamepads to a page after a button press). Xbox's own "No controller
  // detected" prompt just means the button press hasn't happened yet.
  let last = '';
  setInterval(async () => {
    const { pads } = await ptt.getStatus();
    const state = { os: osGamepadCount(), page: pads };
    const key = `${state.os}/${state.page}`;
    if (key === last) return;
    last = key;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('gamepad:state', state);
    }
  }, 3000);
}

// Count game controllers the KERNEL sees (joystick handlers), regardless of
// whether the page has been given access yet.
function osGamepadCount() {
  try {
    const txt = fs.readFileSync('/proc/bus/input/devices', 'utf8');
    return txt.split('\n\n').filter((b) => /Handlers=.*\bjs\d/.test(b)).length;
  } catch {
    return 0;
  }
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
// Only the primary instance boots the app; a secondary already called quit().
if (hasInstanceLock)
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
