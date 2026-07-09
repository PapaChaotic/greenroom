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

## Features

- 🎙 **Party voice chat** — mic permission is pre-scoped to xbox.com; voice just works
- ⌨️ **Customizable hotkeys** — mic toggle (push-to-talk style) and Game Bar view, rebindable in Settings
- 🪟 **Game Bar view** — hotkey flips the app into a compact, always-on-top panel while you game
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
| Mic toggle | `Ctrl+Shift+M` | Works globally on X11/Deck; focus-only on Wayland desktops without the GlobalShortcuts portal |
| Game Bar view | `Ctrl+Shift+G` | Compact always-on-top panel |

Rebind both in **Settings** (gear icon or tray menu).

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
