# Changelog

## 0.9.0-beta.6 (2026-07-09)

### Fixed
- **Update checks are now self-healing.** If a check or download fails
  (release still uploading, flaky network), GreenRoom quietly retries up to
  3 times, 10 minutes apart. Manual checks explain this in plain words
  instead of dumping HTTP headers.
- Releases are now published atomically (uploaded as a draft, flipped live
  only when complete), so an update check can never catch a half-uploaded
  release again.

## 0.9.0-beta.5 (2026-07-09)

### Added
- **📌 Pin button on the Game Bar HUD** — while pinned, clicking outside no
  longer dismisses it (Esc, ✕, and the hotkey still do). Pin state is
  remembered.
- **Settings: "Send app to tray when opening the Game Bar HUD"** — untick it
  to keep the main window and the HUD up at the same time.

## 0.9.0-beta.4 (2026-07-09)

### Fixed
- **Hotkeys now work while your game is focused.** GreenRoom requests the
  Wayland GlobalShortcuts portal (KDE: approve the prompt once). New
  universal fallback for any desktop: bind a system shortcut to
  `GreenRoom.AppImage --hud` or `--mic` — the single-instance app picks the
  signal up from anywhere, no portal needed.

### Changed
- Summoning the Game Bar HUD now sends the main window to the tray, so only
  the pill floats over your game.

## 0.9.0-beta.3 (2026-07-09)

### Changed
- **The Game Bar is now a real HUD.** `Ctrl+Shift+G` summons a small,
  slightly transparent pill of party essentials — mic toggle, a party-audio
  activity light, open-app, and dismiss — instead of the full web page.
  Drag it anywhere; Esc or clicking away hides it. The Xbox page keeps
  running hidden in the background, so voice never drops.
- The party-audio light senses inbound voice through WebRTC analysis — no
  scraping of Microsoft's UI. Per-member "who's talking" is a future item.

## 0.9.0-beta.2 (2026-07-09)

### Changed
- **Game Bar view is now a true overlay.** The hotkey (`Ctrl+Shift+G`)
  summons a pinned panel over whatever you're doing — even while GreenRoom
  sits in the tray. **Esc or clicking away dismisses it**; the party keeps
  running in the background. Opening the app normally (tray → Show GreenRoom)
  restores your regular window size.

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
