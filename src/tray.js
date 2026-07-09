const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let actions = null;
let micMuted = false;

const icon = (name) =>
  nativeImage.createFromPath(path.join(__dirname, '..', 'assets', name));

function rebuildMenu(config) {
  const hk = config.hotkeys;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show GreenRoom', click: actions.show },
      {
        label: micMuted ? 'Unmute mic' : 'Mute mic',
        sublabel: hk.toggleMic || undefined,
        click: actions.toggleMic,
      },
      {
        label: 'Game Bar view',
        sublabel: hk.gameBar || undefined,
        click: actions.toggleGameBar,
      },
      { type: 'separator' },
      { label: 'Settings…', click: actions.openSettings },
      { label: 'Check for updates…', click: actions.checkUpdates },
      { type: 'separator' },
      { label: 'Quit GreenRoom', click: actions.quit },
    ])
  );
  tray.setToolTip(
    micMuted ? 'GreenRoom — mic muted' : 'GreenRoom — mic live'
  );
}

function create(config, trayActions) {
  actions = trayActions;
  tray = new Tray(icon('tray.png'));
  tray.on('click', actions.show);
  rebuildMenu(config);
  return tray;
}

function setMicState(m, config) {
  if (!tray) return;
  micMuted = m;
  tray.setImage(icon(m ? 'tray-muted.png' : 'tray.png'));
  rebuildMenu(config);
}

const refresh = (config) => tray && rebuildMenu(config);

module.exports = { create, setMicState, refresh };
