// electron-builder afterPack hook: flip Electron "fuses" in the shipped
// binary. Fuses are hardware-style kill switches baked into the executable —
// they can't be re-enabled by flags or env vars at runtime.
const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;
  const exe = path.join(context.appOutDir, context.packager.executableName);

  await flipFuses(exe, {
    version: FuseVersion.V1,
    // The binary can never be repurposed as a generic Node runtime.
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // Session cookies (the Microsoft sign-in) are encrypted via the OS keyring.
    [FuseV1Options.EnableCookieEncryption]: true,
    // Only the packaged app.asar can be loaded — no sideloaded app code.
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
  console.log(`fuses flipped on ${exe}`);
};
