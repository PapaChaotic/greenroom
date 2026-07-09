// Global hotkeys with an in-app fallback.
//
// globalShortcut works on X11/XWayland everywhere. On native Wayland it needs
// the GlobalShortcuts desktop portal (KDE ships it; GNOME 48+). As a fallback,
// the same accelerators are also matched on before-input-event, so hotkeys
// ALWAYS work while any app window is focused even where the portal is absent.
const { globalShortcut } = require('electron');

function parseAccel(accel) {
  const parts = accel.split('+');
  const key = parts.pop();
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  return {
    key: key.toLowerCase(),
    control:
      mods.has('control') || mods.has('ctrl') || mods.has('commandorcontrol'),
    shift: mods.has('shift'),
    alt: mods.has('alt'),
    meta: mods.has('super') || mods.has('meta'),
  };
}

function matchesInput(spec, input) {
  return (
    input.type === 'keyDown' &&
    input.key.toLowerCase() === spec.key &&
    !!input.control === spec.control &&
    !!input.shift === spec.shift &&
    !!input.alt === spec.alt &&
    !!input.meta === spec.meta
  );
}

// Register globals; returns {name: boolean} so callers can surface failures.
function applyGlobal(config, actions) {
  globalShortcut.unregisterAll();
  const results = {};
  for (const [name, accel] of Object.entries(config.hotkeys)) {
    if (!accel || !actions[name]) continue;
    try {
      results[name] = globalShortcut.register(accel, actions[name]);
    } catch {
      results[name] = false;
    }
  }
  return results;
}

// In-app fallback: match the same accelerators while our windows are focused.
function attachFallback(contents, getConfig, actions) {
  contents.on('before-input-event', (event, input) => {
    const hotkeys = getConfig().hotkeys;
    for (const [name, accel] of Object.entries(hotkeys)) {
      if (!accel || !actions[name]) continue;
      if (matchesInput(parseAccel(accel), input)) {
        event.preventDefault();
        actions[name]();
        return;
      }
    }
  });
}

// Used by the settings UI to validate a candidate accelerator.
function testAccelerator(accel) {
  try {
    const ok = globalShortcut.register(accel, () => {});
    if (ok) globalShortcut.unregister(accel);
    // Even if global registration fails (Wayland), the in-app fallback will
    // still honor it, so a parseable accelerator is accepted.
    return { valid: true, global: ok };
  } catch {
    return { valid: false, global: false };
  }
}

module.exports = { applyGlobal, attachFallback, testAccelerator };
