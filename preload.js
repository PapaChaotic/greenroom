const { contextBridge, ipcRenderer } = require('electron');

// Minimal, safe bridge for our shell windows. No Node APIs leak to any page,
// and only these fixed channels can be reached from the renderer.
contextBridge.exposeInMainWorld('greenroom', {
  // window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  onMaximized: (cb) => ipcRenderer.on('win:maximized', (_e, v) => cb(v)),

  // mic / push-to-talk
  toggleMic: () => ipcRenderer.invoke('mic:toggle'),
  getMic: () => ipcRenderer.invoke('mic:get'),
  onMicState: (cb) => ipcRenderer.on('mic:state', (_e, v) => cb(v)),

  // Game Bar HUD + hotkey status
  hudHide: () => ipcRenderer.send('hud:hide'),
  hudOpenApp: () => ipcRenderer.send('hud:open'),
  onHudStatus: (cb) => ipcRenderer.on('hud:status', (_e, v) => cb(v)),
  onHotkeyStatus: (cb) => ipcRenderer.on('hotkeys:status', (_e, v) => cb(v)),

  // settings
  openSettings: () => ipcRenderer.send('settings:open'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  testAccelerator: (accel) =>
    ipcRenderer.invoke('settings:testAccelerator', accel),
  checkUpdates: () => ipcRenderer.send('updates:check'),
});
