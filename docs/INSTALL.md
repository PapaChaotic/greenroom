# Installing GreenRoom

All builds are on the [Releases page](https://github.com/PapaChaotic/greenroom/releases).
During beta, releases are marked **Pre-release**.

## AppImage (recommended — every distro, auto-updates)

```bash
chmod +x GreenRoom-*.AppImage
./GreenRoom-*.AppImage
```

The AppImage is the only package that can **self-update**: when a new beta is
out, GreenRoom asks, downloads, and restarts itself. Keep the file somewhere
stable (e.g. `~/Applications/`).

Optional desktop integration (menu entry): use your distro's AppImage
integrator (e.g. Gear Lever on Flathub) or create a `.desktop` file pointing
at the AppImage.

## Debian / Ubuntu / Mint (.deb)

```bash
sudo apt install ./greenroom_*.deb
```

## Fedora / Nobara / openSUSE (.rpm)

```bash
sudo dnf install ./greenroom-*.rpm
```

For deb/rpm, GreenRoom still checks for updates and notifies you, but your
package manager does the installing — the app opens the download page for you.

## Steam Deck

GreenRoom auto-scales its UI 125% on the Deck's 1280×800 panel and works in
both Desktop and Game Mode.

1. Switch to **Desktop Mode** (Steam button → Power → Switch to Desktop).
2. Download the **AppImage** with Firefox, save to `~/Applications/`
   (create the folder if needed), then:
   ```bash
   chmod +x ~/Applications/GreenRoom-*.AppImage
   ```
3. Run it once in Desktop Mode to **sign in** to your Microsoft account
   (the on-screen keyboard is easier here: Steam+X).
4. To use it in **Game Mode**: open Steam (still in Desktop Mode) →
   **Games → Add a Non-Steam Game to My Library** → Browse →
   select the AppImage → Add. Optionally rename it "GreenRoom" in Properties.
5. Back in Game Mode, launch GreenRoom from your Library. The **mic-toggle
   hotkey works globally** in Game Mode; you can also map it to a back button
   with Steam Input (map a button to `Ctrl+Shift+M`).

Notes:
- Sign-in persists across reboots (stored in the Deck's user profile).
- When SteamOS updates wipe nothing here — the AppImage and its data live in
  your home directory.
- In Game Mode, use the Game Bar hotkey (`Ctrl+Shift+G`) to shrink GreenRoom
  into a compact overlay panel.

## First launch (all platforms)

1. Sign in with your Microsoft account on the embedded Microsoft page.
2. Party chat lives in the social/friends area of the Xbox interface. If you
   don't see a party option, your account may need
   [Xbox Insider enrollment](https://www.xbox.com/en-US/xbox-insider-program).
3. **Cloud gaming** (needs Game Pass): pick a title and hit Play. Plug in a
   controller and **press any button on it** — the titlebar 🎮 turns from
   amber to green and Xbox's "No controller detected" prompt goes away.
4. Check Settings (gear icon): stream quality profile, GPU/CPU video
   decoding, game-audio boost, hotkeys, and UI scale.

### For the best cloud gaming quality

- Leave **stream quality on Maximum** and **video decoding on Hardware**
  (the defaults).
- **NVIDIA GPUs** need the VA-API shim for hardware decoding:
  `sudo dnf install libva-nvidia-driver` (Fedora/Nobara) or
  `nvidia-vaapi-driver` (Arch/Debian), then restart GreenRoom.
  AMD/Intel (including Steam Deck) work out of the box.
- On weak internet, switch to the **Data saver** profile.

## Uninstall

- AppImage: delete the file, plus `~/.config/greenroom/` for your data
- deb: `sudo apt remove greenroom`
- rpm: `sudo dnf remove greenroom`
