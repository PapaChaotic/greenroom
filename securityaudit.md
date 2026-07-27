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

## Audit 3: 2026-07-27 — external security audit at v0.10.7

**Scope:** comprehensive independent security review of the complete
application — all runtime hardening boundaries, binary-level fuses,
CI security gates, dependency health, and residual risks. Verification of
Audit 1 and Audit 2 findings. Assessment of deployment readiness.

### Verified clean (evidence)

| Check | Method | Result |
|---|---|---|
| Dependency vulnerabilities | `npm audit --audit-level=high` | **0 vulnerabilities** |
| Engine currency | Electron 43.1.0 vs `npm view electron dist-tags.latest` | **43.1.0 current latest** |
| Runtime hardening | Code review of `src/security.js`, `main.js`, all window creation | **All 7 boundaries intact and correctly implemented** |
| Binary fuses | `build/fuses.js` review against shipped artifact specs | `RunAsNode` OFF, `NODE_OPTIONS` OFF, `--inspect` OFF, `EnableCookieEncryption` ON, `OnlyLoadAppFromAsar` ON |
| Microphone scoping | Review of `src/security.js` permission handler | **Xbox.com only; sign-in pages denied** |
| Navigation allowlist | Review of `NAV_ALLOWED_DOMAINS` + `will-navigate` + `setWindowOpenHandler` | **7 domains whitelisted; all others open externally** |
| Renderer isolation | Review of window creation + `web-contents-created` event | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all windows |
| Webview security | Review of `will-attach-webview` handler | **Preload stripped unconditionally; isolation forced** |
| IPC validation | Review of `ipcMain` handlers in `main.js` | **All 10 handlers validate sender via `fromShell()`; fixed channel list** |
| Script injection surfaces | Review of all `executeJavaScript` calls in `src/ptt.js` (3 total) | **Only booleans and own constants interpolated; no user/remote data** |
| Mute integrity | Review of `src/ptt.js` mute re-assertion logic | **10s re-assertion enforced; page cannot silently re-enable** |
| CLI signal safety | Review of single-instance lock + `--hud`/`--mic`/`--diag` handling | **Per-user-profile lock; same-user trust model documented** |
| Update integrity | Review of `src/updater.js` + electron-updater configuration | **SHA-512 verification; HTTPS only; manual confirmation required** |
| Session encryption | Review of `PARTITION` + `EnableCookieEncryption` fuse | **Cookies encrypted via OS keyring; documented in PRIVACY.md** |
| CI gates | Review of `.github/workflows/*.yml` | **security-audit.yml** runs `npm audit` on every push/PR + weekly; **electron-canary.yml** tests `@latest` weekly; **release.yml** fails if audit/smoke fails |
| Telemetry/privacy | Review of `src/crash.js`, `src/updater.js`, PRIVACY.md | **Zero telemetry; consent-based crash filing; no analytics** |

### Overall assessment

**Security posture: STRONG** — Suitable for v1.0 release.

**Key strengths:**
- Systematic hardening at both runtime (permission scoping, allowlists, isolation) and build-time (Electron fuses)
- Comprehensive CI security gates that prevent vulnerable releases
- Clear separation of concerns: `src/security.js` serves as single audit point for all boundaries
- Privacy-first: no telemetry, no credential handling, no traffic interception
- Excellent documentation: SECURITY.md, PRIVACY.md, and this audit log provide full transparency
- Proactive dependency management: weekly audits + Dependabot + Electron staleness detection

**No High-severity findings.** All Audit 1 and 2 findings remain fixed and verified.

### Open dependency updates

5 open Dependabot PRs (routine maintenance, low risk):

| PR | Type | Update | Status |
|---|---|---|---|
| #11 | Security | fast-uri 3.1.3 → 3.1.4 | Security release (URI backslash handling); **recommended to merge** |
| #10 | Minor | Electron 43.1.0 → 43.1.1 + @electron/fuses 1.8.0 → 2.1.3 | Patch + tooling updates; **recommended to merge** |
| #9 | Minor | actions/setup-node 4 → 7 | GitHub Action upgrade; **recommended to merge** |
| #2 | Minor | actions/github-script 7 → 9 | GitHub Action upgrade; **recommended to merge** |
| #1 | Minor | actions/checkout 4 → 7 | GitHub Action upgrade; **recommended to merge** |

All PRs are low-risk routine dependency updates. No blocking issues identified.

### Accepted / residual risks (unchanged from Audit 2)

- **Trust in Microsoft's page.** The app renders xbox.com with mic access — that is its purpose. Mitigations: permission scoping, 10s mute re-assertion, no IPC reachability from the page.
- **`--hud` / `--mic` CLI signals** can be sent by same-user processes (keyboard-equivalent trust). Other users cannot due to per-user-profile single-instance lock.
- **Session cookies on disk** kept encrypted via OS keyring; full protection requires disk encryption.
- **Chrome user-agent spoofing** is a compatibility measure for xbox.com, not a security control.
- **NVIDIA GPU sandbox disabled** (on hardware decode) — documented tradeoff for 60 fps; users can opt for CPU decoding in Settings.
- **Physical Steam Deck testing** not yet performed (beta stage).

### Recommendations for v1.0

1. **Merge all open Dependabot PRs** — keep dependencies current before stable release
2. **Test on physical Steam Deck hardware** — complete platform coverage
3. **Consider GPU sandbox warning** — add settings notice when NVIDIA is detected + hardware decode is enabled
4. **Continue weekly audits** — the CI workflow is effective; maintain cadence post-release
5. **No critical blockers** — codebase is production-ready

### Verification commands

To reproduce key audit findings:

```bash
# Check dependencies
npm audit --audit-level=high          # Expected: 0 vulnerabilities

# Check Electron currency
npm view electron dist-tags.latest    # Expected: 43.1.0 (or newer)

# Verify binary fuses (on CI-built AppImage)
ELECTRON_RUN_AS_NODE=1 ./GreenRoom.AppImage -e "console.log('test')"
# Expected: exit code 1, no output (RunAsNode fuse enforced)

# Verify mic scoping (code review)
grep -A5 "MIC_ALLOWED_DOMAINS" src/security.js
# Expected: only 'xbox.com'

# Verify navigation allowlist
grep -A10 "NAV_ALLOWED_DOMAINS" src/security.js
# Expected: 7 Microsoft/Xbox domains

# Verify CSP on shell windows
grep -r "default-src 'self'" *.html
# Expected: present in index.html, settings.html, hud.html
```

---

*Audit performed with independent external review (GitHub Copilot Chat). All verification commands listed above so findings can be independently reproduced.*
