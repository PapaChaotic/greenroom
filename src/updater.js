// Update pipeline (see docs/RELEASING.md for the release side).
//
// - AppImage: electron-updater checks GitHub releases (beta prereleases
//   included), PROMPTS the user, downloads, and restarts into the new version.
// - deb/rpm: auto-install isn't possible without root, so we prompt and open
//   the release page for the user's package manager to take over.
// Nothing is ever downloaded or installed without an explicit user "yes".
const { app, dialog, shell } = require('electron');

let autoUpdater = null;
let getWindow = () => null;
let repoUrl = null;
let checking = false;

// Background-discovered updates NEVER open a dialog — gaming and party chat
// must not be interrupted. They're parked here and surfaced passively (tray
// item + in-app notice); the dialog flow only runs when the user asks.
let pendingUpdate = null;
let interactive = false;
let onPendingUpdate = () => {};

// Transient failures (release mid-upload, flaky network, GitHub hiccup)
// self-heal: retry a few times, spaced out, then give up until the next
// scheduled check.
const RETRY_DELAY_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;
let retries = 0;
let retryTimer = null;

const isAppImage = () => !!process.env.APPIMAGE;

function releasesUrl() {
  return `${repoUrl}/releases/latest`;
}

function scheduleRetry() {
  if (retries >= MAX_RETRIES || retryTimer) return false;
  retries += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    check();
  }, RETRY_DELAY_MS);
  return true;
}

async function promptAndApply(info) {
  const win = getWindow();
  const version = info?.version ?? 'a new version';
  if (isAppImage()) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update available',
      message: `GreenRoom ${version} is available.`,
      detail:
        'Download and restart to update? Your sign-in and settings are kept.',
      buttons: ['Download && restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        console.error('update download failed:', err.message);
        const willRetry = scheduleRetry();
        dialog.showMessageBox(getWindow(), {
          type: 'warning',
          message: 'The update download was interrupted.',
          detail: willRetry
            ? "No harm done — you're still on the current version. GreenRoom " +
              'will quietly retry in about 10 minutes and ask again.'
            : "No harm done — you're still on the current version. " +
              `You can also grab it manually at:\n${releasesUrl()}`,
        });
      }
    }
  } else {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update available',
      message: `GreenRoom ${version} is available.`,
      detail: 'Open the download page to get the new .deb/.rpm?',
      buttons: ['Open download page', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) shell.openExternal(releasesUrl());
  }
}

async function check({ manual = false } = {}) {
  if (checking) return;
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox(getWindow(), {
        type: 'info',
        message: 'Update checks only run in packaged builds.',
      });
    }
    return;
  }
  checking = true;
  interactive = manual;
  try {
    const result = await autoUpdater.checkForUpdates();
    retries = 0; // healthy again — future failures get a fresh retry budget
    // An available update is handled by the 'update-available' event.
    if (manual && result?.isUpdateAvailable === false) {
      dialog.showMessageBox(getWindow(), {
        type: 'info',
        message: `You're up to date (GreenRoom ${app.getVersion()}).`,
      });
    }
  } catch (err) {
    console.error('update check failed:', err.message);
    // Background checks retry silently; the user only ever hears about a
    // failure they triggered themselves.
    const willRetry = scheduleRetry();
    if (manual) {
      // err.message can be a multi-page HTTP dump; keep the human part.
      const reason = String(err.message).split('\n')[0].slice(0, 200);
      dialog.showMessageBox(getWindow(), {
        type: 'warning',
        message: "Couldn't check for updates right now.",
        detail:
          `${reason}\n\n` +
          'If a release went out moments ago its files may still be ' +
          'uploading. ' +
          (willRetry
            ? 'GreenRoom will retry on its own in about 10 minutes — no ' +
              'action needed.'
            : `You can check manually at:\n${releasesUrl()}`),
      });
    }
  } finally {
    checking = false;
    interactive = false;
  }
}

// Called from the tray's "Update to X available…" item (or anywhere else the
// user explicitly opts in) — runs the consent dialog for a parked update.
function promptPending() {
  if (pendingUpdate) promptAndApply(pendingUpdate);
}

function init({ windowGetter, config, repositoryUrl, onUpdateAvailable }) {
  getWindow = windowGetter;
  repoUrl = repositoryUrl;
  if (onUpdateAvailable) onPendingUpdate = onUpdateAvailable;

  if (!app.isPackaged) return { check, promptPending };

  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true; // beta channel

  autoUpdater.on('update-available', (info) => {
    pendingUpdate = info;
    if (interactive) {
      // The user asked — talk to them.
      promptAndApply(info);
    } else {
      // Background find: no dialogs, no focus steal. Surface passively.
      onPendingUpdate(info);
    }
  });
  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: 'Update ready',
      message: 'The update is downloaded.',
      buttons: ['Restart now', 'On next launch'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
    else autoUpdater.autoInstallOnAppQuit = true;
  });
  autoUpdater.on('error', (err) =>
    console.error('autoUpdater error:', err.message)
  );

  // Startup check (delayed so it never slows launch), then every 6 hours.
  if (config.checkUpdates) {
    setTimeout(() => check(), 15_000);
    setInterval(() => check(), 6 * 60 * 60 * 1000);
  }
  return { check, promptPending };
}

module.exports = { init };
