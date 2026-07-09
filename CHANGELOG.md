# Changelog

## 0.10.4 (2026-07-09)

### Added
- **`--diag` flag**: run `GreenRoom.AppImage --diag` while the app is open
  to pop Chromium's diagnostic pages (chrome://webrtc-internals and
  chrome://gpu). webrtc-internals shows the *actual* decoder the game
  stream is using — the ground truth for hardware-decode debugging.

## 0.10.3 (2026-07-09)

### Fixed
- **NVIDIA hardware decode, final piece: the GPU-process sandbox.** The
  NVIDIA VA-API shim must initialize CUDA inside Chromium's GPU process,
  which that sandbox forbids (the shim's documented Chromium limitation).
  With Hardware decoding on an NVIDIA GPU, GreenRoom now relaxes the
  GPU-process sandbox only — renderers, the Xbox webview, and shell windows
  stay fully sandboxed, and the navigation allowlist still controls what
  reaches the decoder. Selecting Software decoding restores it. Documented
  in SECURITY.md and the audit log. AMD/Intel unaffected.

## 0.10.2 (2026-07-09)

### Fixed
- **NVIDIA hardware decode, attempt two — the driver env var is now set at
  process birth.** Chromium's child processes inherit the environment from
  before any app code runs, so 0.10.1's runtime fix never took effect. On
  NVIDIA systems the app now respawns itself once at startup with
  `LIBVA_DRIVER_NAME=nvidia` in the real environment (instant, loop-guarded,
  skipped if you exported the variable yourself). A small `boot.log` in the
  config directory records the decision for debugging.

## 0.10.1 (2026-07-09)

### Fixed
- **NVIDIA hardware decode actually engages now.** The GPU process is told
  which VA-API driver to load (`LIBVA_DRIVER_NAME=nvidia`, set only when an
  NVIDIA GPU is present) — without it, Chromium silently fell back to
  software decoding even with the shim installed.
- **Two-stage controller indicator.** The titlebar 🎮 now reads the kernel's
  device list: **amber** = controller plugged in but the page can't use it
  yet (press any button — a browser privacy rule no app can bypass),
  **green** = active. Explains Xbox's "No controller detected" prompt
  instead of leaving users to think a driver is missing.

## 0.10.0 (2026-07-09)

### Added
- **GPU/CPU video decoding toggle** (Settings, default: Hardware/GPU).
  Hardware decode is what unlocks 60 fps streams — the server only sends
  60 when the client can decode in budget. Software/CPU remains as a
  compatibility fallback. NVIDIA needs the system VA-API shim
  (`libva-nvidia-driver`); AMD/Intel work out of the box. Restart to apply.
- **Data saver stream profile** (~8 Mbps) for weak connections, alongside
  Balanced / Maximum / Headroom. Profile names now say what they mean.
- **Game audio boost** slider (100–300%) — boosts the game stream without
  touching party voices, applies live.
- **🎮 Controller indicator** in the titlebar: lights up the moment the app
  sees your gamepad (press any button), so "Xbox's menu ignores my
  controller until the game starts" reads as what it is — Microsoft's web
  UI behavior, not a detection failure. FAQ section added to the README.

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
