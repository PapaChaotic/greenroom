# GreenRoom <sub>BETA</sub>

**Unofficial Xbox party chat client for Linux — including Steam Deck.**

GreenRoom wraps Microsoft's own **web** party chat (`xbox.com/play`) in a
focused, Game Bar–style desktop app: sign in with your normal Microsoft
account, join a party, and talk — with the gaming conveniences a browser tab
can't give you.

> **Honesty first:** GreenRoom is an independent project, **not affiliated
> with, endorsed by, or sponsored by Microsoft**. Xbox is a trademark of
> Microsoft Corporation. Under the hood this is Microsoft's official web
> party chat rendered in a hardened Chromium shell — we don't touch the
> protocol, your credentials, or your traffic.

## Screenshots

**The app** — the full Xbox experience in a Game Bar–style shell:

![GreenRoom main window](docs/screenshots/main-window.png)

**Party chat** — start a party from the social panel, exactly like on Xbox:

![Party panel with Start a party](docs/screenshots/party-panel.png)

**The Game Bar HUD** — `Ctrl+Shift+G` while gaming: mic toggle, party-audio
light, and a 📌 pin, in a translucent pill you can drag anywhere. The full
app stays tucked away in the tray:

![Game Bar HUD pill](docs/screenshots/hud-pill.png)

## Features

- 🎙 **Party voice chat** — mic permission is pre-scoped to xbox.com; voice just works
- ⌨️ **Customizable hotkeys** — mic toggle (push-to-talk style) and Game Bar HUD, rebindable in Settings
- 🪟 **Game Bar HUD** — hotkey summons a small translucent pill of party essentials (mic toggle, party-audio light) over your game; Esc or clicking away dismisses it while the party keeps running
- 🔕 **System tray** — closing the window keeps your party running; mute from the tray
- 🖥 **Steam Deck ready** — auto-scales 125% on Deck-size screens (manual 100–150% override)
- 🔄 **Safe updates** — the app checks GitHub releases, asks you, then updates and restarts (AppImage) or opens the download page (deb/rpm). Nothing installs without your consent
- 🔒 **Security as a feature** — see [SECURITY.md](SECURITY.md); no telemetry, see [PRIVACY.md](PRIVACY.md)

## Install

Grab the latest **beta** from [Releases](https://github.com/PapaChaotic/greenroom/releases):

| Package | For | Updates |
|---|---|---|
| `GreenRoom-x.y.z.AppImage` | Any distro, Steam Deck | In-app, automatic after your OK |
| `.deb` | Debian/Ubuntu/Mint | In-app prompt → download page |
| `.rpm` | Fedora/Nobara/openSUSE | In-app prompt → download page |

AppImage: `chmod +x GreenRoom-*.AppImage && ./GreenRoom-*.AppImage`

Full instructions, including **Steam Deck setup**, in [docs/INSTALL.md](docs/INSTALL.md).

## Default hotkeys

| Action | Default | Notes |
|---|---|---|
| Mic toggle | `Ctrl+Shift+M` | See hotkey notes below |
| Game Bar HUD | `Ctrl+Shift+G` | Summons the translucent party pill (main window goes to the tray); Esc or click-away dismisses |

Rebind both in **Settings** (gear icon or tray menu).

### Hotkeys on Wayland (and the always-works fallback)

Wayland desktops don't let apps grab keys globally unless the desktop provides
the **GlobalShortcuts portal** — GreenRoom requests it automatically (KDE
Plasma supports it; approve the prompt and manage the keys in System Settings
→ Shortcuts). X11 sessions, XWayland games (Proton), and Steam Deck Game Mode
work without any of this.

If globals still don't reach you, use the fallback that works everywhere:
GreenRoom is single-instance, so invoking the binary again just signals the
running app. Bind these to any key in your desktop's custom-shortcut settings
(or a Steam Deck back button via Steam Input):

```bash
GreenRoom.AppImage --hud   # toggle the Game Bar HUD
GreenRoom.AppImage --mic   # toggle your microphone
```

## Requirements & known limitations

- An Xbox/Microsoft account. Party chat on the web rolled out via the Xbox
  Insider program; if the party UI doesn't appear for your account, enroll at
  [xbox.com insider program](https://www.xbox.com/en-US/xbox-insider-program).
- **Voice chat only** — cloud gaming video needs Widevine DRM which this build
  intentionally omits (chat-first scope).
- Mic capture uses your system's PipeWire/PulseAudio; if the mic works in
  Chromium, it works here.
- **Beta**: expect rough edges — crashes offer a pre-filled GitHub issue
  (nothing is ever sent automatically).

## Building from source

```bash
npm ci
npm start            # run in dev
npm run dist         # build AppImage + deb + rpm into dist/
```

## License

[MIT](LICENSE). Not affiliated with Microsoft. Xbox and related marks are
trademarks of Microsoft Corporation, used here only to describe compatibility.
