/**
 * Preload script — bro mellem Electron og browser
 * Eksponerer kun det der er nødvendigt til renderer-processen
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Hent hardware-ID til licensaktivering
  getHwid: () => ipcRenderer.invoke('get-hwid'),
  // Gem og hent licens-token lokalt
  saveLicense: (data) => ipcRenderer.invoke('save-license', data),
  getLicense:  ()     => ipcRenderer.invoke('get-license'),
  // App version
  getVersion: () => ipcRenderer.invoke('get-version'),
  // Licens aktivering (bruges af license-screen.html)
  activateLicense:  (key) => ipcRenderer.invoke('license-activate', key),
  licenseActivated: ()    => ipcRenderer.send('license-activated'),
});
