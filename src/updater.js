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

const isAppImage = () => !!process.env.APPIMAGE;

function releasesUrl() {
  return `${repoUrl}/releases/latest`;
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
    if (response === 0) await autoUpdater.downloadUpdate();
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
  try {
    const result = await autoUpdater.checkForUpdates();
    // An available update is handled by the 'update-available' event.
    if (manual && result?.isUpdateAvailable === false) {
      dialog.showMessageBox(getWindow(), {
        type: 'info',
        message: `You're up to date (GreenRoom ${app.getVersion()}).`,
      });
    }
  } catch (err) {
    console.error('update check failed:', err.message);
    if (manual) {
      // err.message can be a multi-page HTTP dump; keep the human part.
      const reason = String(err.message).split('\n')[0].slice(0, 200);
      dialog.showMessageBox(getWindow(), {
        type: 'warning',
        message: 'Update check failed.',
        detail:
          `${reason}\n\n` +
          'If a release was published moments ago it may still be uploading — ' +
          `try again in a few minutes, or check manually at:\n${releasesUrl()}`,
      });
    }
  } finally {
    checking = false;
  }
}

function init({ windowGetter, config, repositoryUrl }) {
  getWindow = windowGetter;
  repoUrl = repositoryUrl;

  if (!app.isPackaged) return { check };

  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true; // beta channel

  autoUpdater.on('update-available', (info) => promptAndApply(info));
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
  return { check };
}

module.exports = { init };
