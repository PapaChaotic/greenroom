# Releasing a beta

## One-time setup (do this first)

1. Create the GitHub repository (e.g. `greenroom`) under your account.
2. Replace every `PapaChaotic` with your GitHub username:
   ```bash
   grep -rl PapaChaotic --exclude-dir=node_modules --exclude-dir=.git . \
     | xargs sed -i 's/PapaChaotic/your-username/g'
   ```
   Also update `build.appId` in `package.json`
   (`io.github.your-username.greenroom`).
3. Push:
   ```bash
   git remote add origin git@github.com:your-username/greenroom.git
   git push -u origin main
   ```
4. In the repo settings, confirm **Actions** are enabled. The bundled
   workflows need no extra secrets — `GITHUB_TOKEN` is automatic.

## Cutting a release

```bash
# bump the beta number (0.9.0-beta.1 -> 0.9.0-beta.2)
npm version prerelease --preid=beta

git push origin main    # just main — do NOT push the tag
```

**Never `git push --tags`.** The in-app updater sees new tags immediately,
minutes before a build finishes, and update checks in that window fail.
Instead, CI notices the version bump on main and releases **atomically**:

1. **gate** — skips entirely unless `package.json`'s version has no tag yet,
2. security gate (`npm audit`, fails on high+) and smoke test under Xvfb,
3. builds **AppImage + deb + rpm** with the security fuses flipped into a
   tagless **draft** release,
4. publishes the draft — GitHub creates the `vX.Y.Z` tag at the same instant
   the assets become downloadable. There is no moment where an update check
   can see a version it can't download.

(`npm version` still creates a local tag; it matches the one CI creates, so
leave it be. The workflow can also be run manually from the Actions tab.)

Users on the AppImage get a passive update notice within ~6 hours (tray menu
item — nothing interrupts them; see src/updater.js). deb/rpm users get
pointed at the release page when they choose to update.

## Promoting beta → stable

When ready for 1.0: `npm version 1.0.0`, `git push origin main`, and after CI
publishes, edit the GitHub release and untick "pre-release". From then on you
may also want to flip `autoUpdater.allowPrerelease` to `false` in
`src/updater.js` so stable users don't get offered future betas.

## If the Electron canary opens an issue

The weekly canary means an `electron@latest` upgrade would break the app.
**Don't upgrade Electron** until it's fixed — but check `security-audit.yml`
results: if the *current* Electron has a vulnerability AND the canary is red,
fixing the canary breakage is the priority, then upgrade and release.
