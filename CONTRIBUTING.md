# Contributing

Thanks for helping! GreenRoom is a small, security-conscious codebase — please
keep it that way.

## Ground rules

- **Security boundaries live in [`src/security.js`](src/security.js)** and are
  documented in [SECURITY.md](SECURITY.md). PRs that widen a boundary
  (new allowed domain, new permission, new IPC channel) must update
  SECURITY.md in the same PR and explain why.
- No telemetry or network calls beyond Microsoft (the product) and GitHub
  (updates) — see [PRIVACY.md](PRIVACY.md). This is non-negotiable.
- Keep dependencies minimal: every new package is attack surface.

## Dev setup

```bash
npm ci
npm start        # run
npm run smoke    # boot test (what CI runs)
npm run dist     # package AppImage/deb/rpm into dist/
```

## Before you open a PR

- `npm run smoke` passes
- `npm audit --audit-level=high` is clean
- If you touched UI: check both a normal window and the compact Game Bar view,
  and ideally a 1280×800 window (Steam Deck size)
