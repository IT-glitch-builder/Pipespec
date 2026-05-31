const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense:  (key) => ipcRenderer.invoke('license-activate', key),
  licenseActivated: ()    => ipcRenderer.send('license-activated'),
  getHwid:          ()    => ipcRenderer.invoke('get-hwid'),
  getVersion:       ()    => ipcRenderer.invoke('get-version'),
});
