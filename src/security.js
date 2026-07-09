// Trust boundaries for the app. Everything security-relevant lives here so it
// can be audited in one place. See SECURITY.md for the policy this implements.
const { session, shell } = require('electron');

// The Xbox web surface that hosts party chat + social features.
const XBOX_URL = 'https://www.xbox.com/play';

// Present as stock Chrome so xbox.com doesn't flag an "unsupported browser".
// Kept in one place; bump alongside Electron upgrades.
const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/142.0.0.0 Safari/537.36';

// Persistent partition => you sign in once and stay signed in across launches.
const PARTITION = 'persist:xbox';

// Domains that may be navigated to inside the embedded webview. Covers Xbox
// itself plus the Microsoft sign-in flow. Anything else opens in the system
// browser so untrusted pages never render inside our (trusted-looking) frame.
const NAV_ALLOWED_DOMAINS = [
  'xbox.com',
  'xboxlive.com',
  'microsoft.com',
  'live.com',
  'microsoftonline.com',
  'msauth.net',
  'msftauth.net',
];

// Only Xbox pages may use the microphone/camera. Sign-in pages get nothing.
const MIC_ALLOWED_DOMAINS = ['xbox.com'];

// Permissions the Xbox web app legitimately needs.
const ALLOWED_PERMISSIONS = new Set([
  'media',
  'audioCapture',
  'videoCapture',
  'notifications',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
]);

const MEDIA_PERMISSIONS = new Set(['media', 'audioCapture', 'videoCapture']);

function hostMatches(url, domains) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith('.' + d));
}

function isPermissionAllowed(permission, requestingUrl) {
  if (!ALLOWED_PERMISSIONS.has(permission)) return false;
  const domains = MEDIA_PERMISSIONS.has(permission)
    ? MIC_ALLOWED_DOMAINS
    : NAV_ALLOWED_DOMAINS;
  return hostMatches(requestingUrl, domains);
}

// Open untrusted URLs in the user's default browser — never in our frame.
function openExternally(url) {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    shell.openExternal(url);
  }
}

function configureSession() {
  const ses = session.fromPartition(PARTITION);
  ses.setUserAgent(CHROME_UA);
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(isPermissionAllowed(permission, details.requestingUrl));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    isPermissionAllowed(permission, requestingOrigin)
  );
  return ses;
}

// Applied to every webContents the app ever creates (see main.js).
function hardenContents(contents) {
  // Defense-in-depth: no webview may ever attach with a preload script or
  // Node integration, regardless of what created it.
  contents.on('will-attach-webview', (_e, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  if (contents.getType() === 'webview') {
    contents.setUserAgent(CHROME_UA);

    // Keep Microsoft sign-in flows inside the webview; kick everything else
    // out to the system browser.
    contents.setWindowOpenHandler(({ url }) => {
      if (hostMatches(url, NAV_ALLOWED_DOMAINS)) {
        contents.loadURL(url);
      } else {
        openExternally(url);
      }
      return { action: 'deny' };
    });

    // Same rule for in-place navigation (e.g. links in chat messages).
    contents.on('will-navigate', (event, url) => {
      if (!hostMatches(url, NAV_ALLOWED_DOMAINS)) {
        event.preventDefault();
        openExternally(url);
      }
    });
  }
}

module.exports = {
  XBOX_URL,
  CHROME_UA,
  PARTITION,
  NAV_ALLOWED_DOMAINS,
  MIC_ALLOWED_DOMAINS,
  hostMatches,
  isPermissionAllowed,
  openExternally,
  configureSession,
  hardenContents,
};
