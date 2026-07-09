# Releasing a beta

## One-time setup (do this first)

1. Create the GitHub repository (e.g. `greenroom`) under your account.
2. Replace every `REPLACE_GITHUB_OWNER` with your GitHub username:
   ```bash
   grep -rl REPLACE_GITHUB_OWNER --exclude-dir=node_modules --exclude-dir=.git . \
     | xargs sed -i 's/REPLACE_GITHUB_OWNER/your-username/g'
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

git push && git push --tags
```

Pushing the `v*` tag triggers `.github/workflows/release.yml`, which:

1. runs the **security gate** (`npm audit`, fails on high+),
2. runs the **smoke test** under Xvfb,
3. builds **AppImage + deb + rpm** with the security fuses flipped,
4. publishes everything as a GitHub **Pre-release** (beta channel).

Users on the AppImage get the update dialog within ~6 hours (or via
Settings → "Check for updates now"). deb/rpm users get a dialog linking to the
release page.

## Promoting beta → stable

When ready for 1.0: `npm version 1.0.0`, push the tag, and after CI publishes,
edit the GitHub release and untick "pre-release". From then on you may also
want to flip `autoUpdater.allowPrerelease` to `false` in `src/updater.js` so
stable users don't get offered future betas.

## If the Electron canary opens an issue

The weekly canary means an `electron@latest` upgrade would break the app.
**Don't upgrade Electron** until it's fixed — but check `security-audit.yml`
results: if the *current* Electron has a vulnerability AND the canary is red,
fixing the canary breakage is the priority, then upgrade and release.
