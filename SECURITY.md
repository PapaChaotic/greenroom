# Security Policy

GreenRoom holds a signed-in Microsoft session and a live microphone grant, so
security is treated as a core feature, not an afterthought. This document is
the complete inventory of the app's trust boundaries and the processes that
keep them enforced.

Audit history — dated findings, fixes, and verification evidence — lives in
[securityaudit.md](securityaudit.md).

## Reporting a vulnerability

Open a [GitHub security advisory](https://github.com/PapaChaotic/greenroom/security/advisories/new)
(preferred), or an issue with the `security` label if it isn't sensitive.
Beta-stage response target: acknowledgment within a week.

## Runtime hardening (enforced in code)

All boundaries live in [`src/security.js`](src/security.js) for single-point audit:

| Boundary | Enforcement |
|---|---|
| Microphone/camera | Granted **only** to `xbox.com` origins — Microsoft sign-in pages, and everything else, get nothing |
| Navigation | The embedded webview may only visit an allowlist of Microsoft/Xbox domains; all other links open in your **system browser**, never inside the app frame (anti-phishing) |
| Shell windows | Load only local files; **all** navigation blocked; CSP `default-src 'self'` |
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every window |
| Webview attach | `will-attach-webview` strips any preload and forces isolation — no privileged webview can ever attach |
| IPC | Fixed channel allowlist in the preload; main process validates every sender before acting. The Xbox page cannot reach IPC (no preload, and webview guests fail sender validation) |
| Popups | `setWindowOpenHandler` denies all popup windows |
| Page hooks | The mic/party-audio code injected into the Xbox page ([`src/ptt.js`](src/ptt.js)) interpolates only booleans/constants — no user or remote data flows into `executeJavaScript` |
| Mute integrity | Mute state is re-asserted into the page every 10s, so page scripts can't silently re-enable the mic while the UI shows muted |
| CLI signals | `--hud` / `--mic` signal the running instance via Electron's single-instance lock, scoped to this user's profile — other local users can't send them |

## Packaged-binary hardening (enforced at build time)

[`build/fuses.js`](build/fuses.js) flips Electron fuses in every shipped binary —
these cannot be re-enabled at runtime:

- `RunAsNode` **off**, `NODE_OPTIONS` **off**, `--inspect` args **off** — the
  binary can't be repurposed as a Node runtime or debugged into
- `EnableCookieEncryption` **on** — your Microsoft session cookies are
  encrypted via the OS keyring
- `OnlyLoadAppFromAsar` **on** — no sideloaded application code

## Continuous monitoring (enforced by CI)

| Process | Where | What it does |
|---|---|---|
| Dependency audit | [`security-audit.yml`](.github/workflows/security-audit.yml) | `npm audit --audit-level=high` on every push/PR **and weekly** (catches new CVEs against unchanged deps). Runs `--ignore-scripts` so untrusted PR dependency trees can't execute code in CI |
| Electron staleness | same workflow | Opens an issue automatically when our Electron major falls behind latest (Chromium security fixes ship in majors) |
| Electron canary | [`electron-canary.yml`](.github/workflows/electron-canary.yml) | Weekly build against `electron@latest`; **auto-opens an issue if the new Electron breaks the app**, so upgrades are never blind |
| Release gate | [`release.yml`](.github/workflows/release.yml) | A release build **fails** if the audit or smoke test fails — vulnerable builds can't ship |
| Dependency updates | [`dependabot.yml`](.github/dependabot.yml) | Weekly PRs, Electron grouped for visibility |

## Update integrity

Updates are fetched exclusively from this repository's GitHub Releases over
HTTPS. electron-updater verifies the SHA-512 checksum embedded in the release
metadata before applying an AppImage update. Nothing downloads or installs
without an explicit user confirmation.

## What GreenRoom does NOT do

- No telemetry, analytics, or automatic crash upload (see [PRIVACY.md](PRIVACY.md))
- No credential handling — sign-in happens on Microsoft's own pages; we never
  see or store your password
- No traffic interception — the app is a rendering shell, not a proxy
