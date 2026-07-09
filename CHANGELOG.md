# Changelog

## 0.9.0-beta.1 — first public beta (2026-07-09)

### Features
- Party voice chat via Microsoft's official web party chat (`xbox.com/play`),
  wrapped in a Game Bar–style Chromium shell
- Persistent Microsoft sign-in (encrypted session, OS keyring)
- Mic toggle (push-to-talk style) — titlebar button, tray, and customizable
  global hotkey (default `Ctrl+Shift+M`)
- Game Bar view: compact always-on-top panel, hotkey `Ctrl+Shift+G`
- System tray with close-to-tray (party keeps running in background)
- Settings window: rebind hotkeys, UI scale, update behavior
- Steam Deck: auto 125% scaling on 1280×800 panels, Game Mode support
- Consent-based updates: AppImage self-updates after your OK; deb/rpm notify
- Consent-based crash reports: pre-filled GitHub issue opens in your browser

### Security
- Mic/camera permissions scoped to xbox.com origins only
- Navigation allowlisted to Microsoft/Xbox domains; everything else opens
  in the system browser
- Sandboxed renderers, context isolation, validated IPC, strict CSP
- Electron fuses flipped in shipped binaries (no RunAsNode, cookie
  encryption, asar-only loading)
- CI: npm audit gate on releases, weekly audits, weekly Electron canary
  with automatic breakage issues

### Known limitations
- Cloud gaming video is out of scope (no Widevine) — this is a chat app
- Web party chat may require Xbox Insider enrollment on some accounts
- Global hotkeys on Wayland need the GlobalShortcuts portal (KDE, GNOME 48+);
  otherwise they work while the app is focused
