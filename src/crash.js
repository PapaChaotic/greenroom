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

function logFile() {
  return path.join(app.getPath('userData'), 'crash.log');
}

function record(entry) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  try {
    fs.appendFileSync(logFile(), line + '\n', { mode: 0o600 });
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

function reportFile() {
  return path.join(app.getPath('userData'), 'last-crash-report.txt');
}

async function offerReport(entry) {
  if (reporting || !repoUrl) return;
  reporting = true;
  try {
    // Always save a local copy first, so the report survives even if the
    // GitHub submission is never completed in the browser.
    const report = issueBody(entry);
    try {
      fs.writeFileSync(reportFile(), report, { mode: 0o600 });
    } catch {}

    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: 'GreenRoom crashed',
      message: `A component crashed (${entry.kind}: ${entry.reason ?? 'unknown'}).`,
      detail:
        'Report it on GitHub? This opens a pre-filled issue in your browser — ' +
        'you must be signed in to GitHub and click "Submit new issue" to send ' +
        'it (nothing is sent automatically). A copy is also saved locally:\n' +
        reportFile(),
      buttons: ['Open GitHub issue', 'Just save locally', 'Dismiss'],
      defaultId: 0,
      cancelId: 2,
    });
    if (response === 0) {
      const title = encodeURIComponent(
        `[crash] ${entry.kind}: ${entry.reason ?? 'unknown'} (v${app.getVersion()})`
      );
      // GitHub rejects overly long issue URLs (~8KB); the local file always
      // has the full report, so a trimmed body in the URL is fine.
      const body = encodeURIComponent(report.slice(0, 4000));
      shell.openExternal(
        `${repoUrl}/issues/new?labels=crash&title=${title}&body=${body}`
      );
    }
  } finally {
    reporting = false;
  }
}

// A main-process abort (GPU-stack crash, SIGKILL, OOM) takes our handlers
// down with it and leaves no trace. Detect it after the fact: a sentinel file
// exists while the app runs and is removed on clean shutdown — finding it at
// startup means the previous session died hard.
function initSentinel() {
  const sentinel = path.join(app.getPath('userData'), '.session-active');
  let crashed = false;
  try {
    crashed = fs.existsSync(sentinel);
    fs.writeFileSync(sentinel, String(process.pid), { mode: 0o600 });
  } catch {
    return;
  }
  app.on('will-quit', () => {
    try {
      fs.unlinkSync(sentinel);
    } catch {}
  });
  if (crashed) {
    const entry = {
      kind: 'previous-session',
      reason: 'terminated without a clean shutdown (hard crash or kill)',
    };
    record(entry);
    // Let the window come up first; this is a consent dialog, not a nag.
    setTimeout(() => offerReport(entry), 4000);
  }
}

function init(repositoryUrl) {
  repoUrl = repositoryUrl;

  // Local minidumps only — uploadToServer stays false, always.
  crashReporter.start({ uploadToServer: false });
  initSentinel();

  app.on('render-process-gone', (_e, _wc, details) => {
    // 'killed' is how OOM and compositor kills report — never ignore it.
    if (details.reason === 'clean-exit') return;
    const entry = { kind: 'renderer', reason: details.reason, exitCode: details.exitCode };
    record(entry);
    offerReport(entry);
  });

  app.on('child-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return;
    const entry = {
      kind: details.type, // 'GPU', 'Utility', ...
      reason: details.reason,
      exitCode: details.exitCode,
    };
    record(entry); // GPU deaths are always logged now, even 'killed' ones
    // GPU process restarts are usually transparent; don't dialog for them.
    if (details.type !== 'GPU') offerReport(entry);
  });

  process.on('uncaughtException', (err) => {
    const entry = { kind: 'main', reason: err.message, stack: err.stack };
    record(entry);
    offerReport(entry);
  });
}

module.exports = { init };
