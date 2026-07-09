# GreenRoom — Security Audit Log

Detailed record of security audits performed on this codebase. Each audit is
appended with a date stamp, scope, findings, fixes, and the verification
evidence behind the "clean" claims. The living security *policy* (what is
enforced and how) is [SECURITY.md](SECURITY.md); this file is the *history*
of checking it.

**Audit triggers** — a new entry is added here when any of the following
happens: an Electron major upgrade, a new IPC channel or permission, a new
domain in the navigation allowlist, a report via a security advisory, or a
promotion to a stable (1.0+) release.

---

## Audit 2: 2026-07-09 — full re-audit at v0.9.0

**Scope:** everything added since Audit 1 — the Game Bar HUD window, the
`--hud`/`--mic` CLI signal path, the JavaScript hooks injected into the Xbox
page (mic control + party-audio analysis), the electron-updater pipeline,
consent-based crash reporting, the tray, the settings store, five new IPC
channels, and all four GitHub Actions workflows — plus re-verification of
every Audit 1 boundary.

### Verified clean (evidence)

| Check | Method | Result |
|---|---|---|
| Dependency vulnerabilities | `npm audit` | **0 vulnerabilities** |
| Engine currency | `electron` 43.1.0 vs `npm view electron dist-tags.latest` | **current latest** (43.1.0) |
| Binary fuses (shipped artifact) | `ELECTRON_RUN_AS_NODE=1 GreenRoom.AppImage -e "console.log(...)"` against the **CI-built** AppImage | no output, exit 1 — **RunAsNode dead** |
| Script injection surface | review of all `executeJavaScript` call sites (3, all in `src/ptt.js`) | only booleans/own constants interpolated; **no user or remote data** reaches injected code |
| Xbox page → IPC reachability | code review | unreachable: webview gets **no preload** (stripped at attach) and webview guests fail the main-process sender validation |
| Audit 1 boundaries | re-review of `src/security.js` + window creation | mic scoped to xbox.com only; navigation allowlist; sandboxed renderers; CSP; popup denial — **all intact** |

### Findings and fixes (4 — none rated High)

| # | Severity | Finding | Fix | Commit |
|---|---|---|---|---|
| 1 | Low | **Mute-state trust boundary.** Mute works by disabling audio tracks *inside the Xbox page's JavaScript world*; scripts in that world could re-enable them while the tray still shows "muted". Requires xbox.com itself to act maliciously (it already holds the mic grant), but a UI that can lie about mic state is unacceptable. | Muted state is **re-asserted into the page every 10 s** — a lie can survive at most one interval. | `b4d207c` |
| 2 | Low | **CI executed untrusted code on PRs.** `security-audit.yml` runs on `pull_request` and ran `npm ci`, which executes dependency lifecycle scripts — a malicious PR bumping a dependency could run code in CI (read-only token). | `npm ci --ignore-scripts` in that workflow. | `b4d207c` |
| 3 | Low | **Release-build race.** A push landing on `main` while a release build was in flight could start a second concurrent build of the same version (duplicate drafts, undefined winner). | Workflow `concurrency` group serializes runs; the queued run sees the freshly created tag and gate-skips. | `22bcf79` |
| 4 | Info | `crash.log` written with default (world-readable) permissions. Contents are low-sensitivity (versions, crash reasons), fixed on principle. | Written `0600`. | `b4d207c` |

### Accepted / residual risks (documented, not fixed)

- **Trust in Microsoft's page.** The app renders xbox.com with mic access —
  that is its purpose. A compromise of Microsoft's own frontend affects
  GreenRoom users as it would browser users. Mitigations: permission scoping,
  the 10 s mute re-assertion, and no IPC reachability from the page.
- **`--hud` / `--mic` CLI signals** can be sent by any process running as the
  same user (the single-instance lock is per-user-profile, so *other* users
  cannot). Same-user processes are already at keyboard-equivalent trust.
- **Session cookies on disk** keep you signed in (the point of the app);
  encrypted via the OS keyring (`EnableCookieEncryption` fuse). Full
  protection requires disk encryption.
- **Chrome user-agent spoofing** is required for xbox.com to serve the app;
  it is a compatibility measure, not a security control.
- Not yet tested on physical Steam Deck hardware.

---

## Audit 1: 2026-07-09 — initial audit (pre-release wrapper)

**Scope:** first audit of the original minimal wrapper (main window +
webview + preload), performed the same day, before the rebrand and public
release. Fixes shipped in the initial public commit (`ddd867f`).

### Findings and fixes (7)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | **End-of-life engine.** Electron 31 (Chromium ~126, mid-2024) with 7 published advisories incl. 1 high. | Upgraded to Electron 43.x → `npm audit` clean. Weekly staleness + canary CI added so this class of finding can't silently recur. |
| 2 | **High** | **Microphone granted to any origin.** The permission handler approved `media`/`audioCapture` for whatever page requested it, anywhere in the session. | Media permissions scoped to `xbox.com` origins only; even Microsoft sign-in domains get nothing. |
| 3 | **High** | **Unrestricted navigation.** Any URL (e.g. a link pasted in chat) loaded *inside* the trusted app frame — a credential-phishing surface that also inherited finding 2's mic grant. | Navigation + popups allowlisted to 7 Microsoft/Xbox domains; everything else opens in the system browser. Shell windows block all navigation. |
| 4 | Medium | `sandbox: false` on the shell window without need. | `sandbox: true` everywhere. |
| 5 | Low | Webview attach parameters not sanitized (defense-in-depth). | `will-attach-webview` strips preloads and forces isolation unconditionally. |
| 6 | Low | IPC handlers didn't validate senders and could double-register. | Sender validation on every channel; single registration. |
| 7 | Info | Session cookies on disk (by design — keeps you signed in). | Documented; later hardened via the `EnableCookieEncryption` fuse in shipped binaries. |

### Also established in this audit cycle

- Electron **fuses** flipped in all shipped binaries (`RunAsNode` off,
  `NODE_OPTIONS` off, `--inspect` off, cookie encryption on, asar-only)
- CI security gates: `npm audit --audit-level=high` fails releases; weekly
  audits; weekly `electron@latest` canary that auto-files an issue on
  breakage; Dependabot
- [SECURITY.md](SECURITY.md) policy and [PRIVACY.md](PRIVACY.md)
  (no telemetry; consent-based crash reporting) written

---

*Audits performed with Claude Code (Claude Fable 5 model). Verification commands are
listed inline so results can be independently reproduced.*
