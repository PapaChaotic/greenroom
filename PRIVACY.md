# Privacy

Short version: **GreenRoom collects nothing and phones home to no one.**

## What stays on your machine

- **Your Microsoft sign-in session** — cookies live in Electron's profile
  directory (`~/.config/greenroom/`), encrypted via your OS keyring
  (the `EnableCookieEncryption` fuse). GreenRoom never sees your password;
  you type it into Microsoft's own pages.
- **Settings** — `~/.config/greenroom/settings.json` (hotkeys, scale, etc.).
- **Crash logs** — `~/.config/greenroom/crash.log`, local only.

## What leaves your machine

- Traffic between the embedded Chromium and **Microsoft's servers** — the same
  traffic a browser tab on xbox.com would generate. Microsoft's
  [privacy statement](https://privacy.microsoft.com/) governs that.
- **Update checks** (if enabled in Settings): a version query against GitHub's
  public releases API for this repository. No identifiers beyond a normal
  HTTPS request.
- **Crash reports — only if you click the button.** When a crash happens,
  GreenRoom offers to open a pre-filled GitHub issue **in your browser**. You
  see exactly what's in it (app/Electron/OS versions and the crash reason — no
  personal data), and you can edit or abandon it. There is no automatic
  transmission, ever.

## What GreenRoom never does

- No analytics, telemetry, tracking, or fingerprinting
- No third-party services beyond Microsoft (the product) and GitHub (updates/issues)
- No reading of your chats, messages, or party audio — those render inside
  Microsoft's web app; GreenRoom is the window frame around it
