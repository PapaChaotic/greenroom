# Changelog

## 0.9.4 (2026-07-09)

### Fixed
- **False "previous session crashed" reports.** A second launch (or a
  quick relaunch) ran startup code it shouldn't have, reading and deleting
  the running instance's crash sentinel — producing phantom crash dialogs.
  Only the primary instance now touches that state.
- **Crash reports can now actually be kept.** The crash dialog always saves
  a full local copy (`last-crash-report.txt`) and spells out that the GitHub
  path needs you signed in and clicking "Submit new issue". Added a "Just
  save locally" option, and the browser issue body is trimmed to stay under
  GitHub's URL length limit (the local copy is always complete).

## 0.9.3 (2026-07-09)

### Fixed
- **Cloud gaming bitrate collapse in fullscreen.** Linux Chromium ships with
  hardware video decode disabled, so the CPU software-decoded the stream;
  under fullscreen presentation the decode pipeline stalled, xCloud's
  app-level latency stat spiked, and the server slashed the bitrate thinking
  the network was congested. Hardware (VA-API) decode is now enabled —
  decode drops to GPU speeds and the stream should hold its bitrate in both
  windowed and fullscreen.

## 0.9.2 (2026-07-09)

### Added
- **Cloud gaming stream quality setting.** Xbox assigns unknown browsers a
  starved bitrate profile (we measured 1440p being fed just 4 Mbps — hence
  the blur). GreenRoom now advertises a higher bandwidth ceiling in the
  WebRTC negotiation, configurable in Settings: Xbox default / 15 / 25
  (default) / 40 Mbps. The stream still adapts down on weak connections;
  this only lifts the cap. Takes effect on the next game launch.

## Unreleased

### Fixed
- **Crash during cloud gaming on Wayland.** Chromium's Vulkan path aborts
  the entire app under streaming video-decode load on native Wayland;
  Vulkan is now disabled (Chromium's own recommendation) in favor of the
  stable GL path.
- **Crash visibility.** Hard crashes (GPU-stack aborts, OOM/compositor
  kills) previously left no trace and no report offer. Now: a session
  sentinel detects unclean shutdowns on next launch and offers a crash
  report; `killed` process deaths are logged instead of ignored.
- **Crash resilience.** If the window is destroyed out from under the app
  (compositor kill), GreenRoom resurrects it from the tray instead of
  silently quitting.
- The HUD party-audio light now ignores cloud-gaming streams (connections
  carrying video) — it responds to party voices, not game sound.

### Corrected
- **Cloud gaming actually works** and the docs now say so. Earlier releases
  claimed gameplay needed Widevine DRM; Xbox Cloud Gaming streams over
  WebRTC, which this app supports natively. Game Pass titles play in the
  app, controller included.

## 0.9.0 (2026-07-09)

First release. GreenRoom is an **unofficial Xbox party chat client for
Linux and Steam Deck** — Microsoft's official web party chat
(xbox.com/play) wrapped in a hardened, Game Bar-style desktop shell.
Not affiliated with or endorsed by Microsoft.

### Highlights
- 🎙 **Party voice chat** with persistent Microsoft sign-in
- 🪟 **Game Bar HUD** (`Ctrl+Shift+G`) — a translucent, draggable pill with
  mic toggle, party-audio activity light, and a 📌 pin; Esc or click-away
  dismisses it while your party keeps running
- ⌨️ **Customizable hotkeys**, with a universal fallback (`greenroom --hud`
  / `--mic`) for Wayland desktops and Steam Input bindings
- 🔕 **System tray** — close to tray, mute from the tray
- 🖥 **Steam Deck**: auto 125% scaling, Game Mode friendly
- 🔄 **Interruption-free updates**: background-found updates wait quietly in
  the tray; nothing downloads, installs, or restarts without your consent
- 🔒 **Security-first**: mic scoped to xbox.com only, navigation allowlisted,
  sandboxed renderers, hardened binaries (Electron fuses), zero telemetry,
  consent-based crash reporting

### Known limitations
- Voice chat only — cloud gaming video (Widevine DRM) is out of scope
- Web party chat may require Xbox Insider enrollment on some accounts
- Native-Wayland global hotkeys need the GlobalShortcuts portal (KDE,
  GNOME 48+) — the `--hud`/`--mic` fallback works everywhere
- Not yet tested on physical Steam Deck hardware — reports welcome!

*(Development history below: beta.1 through beta.7.)*

## 0.9.0-beta.7 (2026-07-09)

### Changed
- **Background updates can no longer interrupt you — ever.** An update found
  by the automatic 6-hour check no longer opens a dialog. Instead it waits
  quietly: a "⬆ Update to X — install…" item appears in the tray menu and a
  brief notice shows in the app. Dialogs (and the download/restart flow) only
  ever run when you explicitly choose to update. Nothing downloads, installs,
  or restarts on its own.

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
