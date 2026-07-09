// Crash handling — the honest kind.
//
// Nothing is ever transmitted automatically. Crashes are logged locally
// (userData/crash.log) and the user is OFFERED a pre-filled GitHub issue that
// opens in their browser, containing only version/OS/reason metadata that
// they can read and edit before submitting. See PRIVACY.md.
const { app, crashReporter, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

let repoUrl = null;
let reporting = false; // don't stack dialogs if crashes cascade

const IGNORED_REASONS = new Set(['clean-exit', 'killed']);

function logFile() {
  return path.join(app.getPath('userData'), 'crash.log');
}

function record(entry) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  try {
    fs.appendFileSync(logFile(), line + '\n');
  } catch {
    /* logging must never crash the crash handler */
  }
  return line;
}

function issueBody(entry) {
  return [
    '<!-- Feel free to add what you were doing when it crashed. -->',
    '',
    '**Crash details (auto-filled, no personal data):**',
    '```json',
    JSON.stringify(
      {
        app: `GreenRoom ${app.getVersion()}`,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        os: `${os.type()} ${os.release()}`,
        wayland: !!process.env.WAYLAND_DISPLAY,
        appimage: !!process.env.APPIMAGE,
        ...entry,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
}

async function offerReport(entry) {
  if (reporting || !repoUrl) return;
  reporting = true;
  try {
    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: 'GreenRoom crashed',
      message: `A component crashed (${entry.kind}: ${entry.reason ?? 'unknown'}).`,
      detail:
        'Report it on GitHub? A pre-filled issue will open in your browser — ' +
        'you can review everything before submitting. Nothing is sent automatically.',
      buttons: ['Report on GitHub', 'Dismiss'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      const title = encodeURIComponent(
        `[crash] ${entry.kind}: ${entry.reason ?? 'unknown'} (v${app.getVersion()})`
      );
      const body = encodeURIComponent(issueBody(entry));
      shell.openExternal(
        `${repoUrl}/issues/new?labels=crash&title=${title}&body=${body}`
      );
    }
  } finally {
    reporting = false;
  }
}

function init(repositoryUrl) {
  repoUrl = repositoryUrl;

  // Local minidumps only — uploadToServer stays false, always.
  crashReporter.start({ uploadToServer: false });

  app.on('render-process-gone', (_e, _wc, details) => {
    if (IGNORED_REASONS.has(details.reason)) return;
    const entry = { kind: 'renderer', reason: details.reason, exitCode: details.exitCode };
    record(entry);
    offerReport(entry);
  });

  app.on('child-process-gone', (_e, details) => {
    if (IGNORED_REASONS.has(details.reason)) return;
    const entry = {
      kind: details.type, // 'GPU', 'Utility', ...
      reason: details.reason,
      exitCode: details.exitCode,
    };
    record(entry);
    // GPU process restarts are usually transparent; only nag on repeat.
    if (details.type !== 'GPU') offerReport(entry);
  });

  process.on('uncaughtException', (err) => {
    const entry = { kind: 'main', reason: err.message, stack: err.stack };
    record(entry);
    offerReport(entry);
  });
}

module.exports = { init };
