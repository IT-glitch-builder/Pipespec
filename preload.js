const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense:     (key) => ipcRenderer.invoke('license-activate', key),
  licenseActivated:    ()    => ipcRenderer.send('license-activated'),
  getHwid:             ()    => ipcRenderer.invoke('get-hwid'),
  getVersion:          ()    => ipcRenderer.invoke('get-version'),
  restartAndUpdate:    ()    => ipcRenderer.send('restart-and-update'),
  onUpdateAvailable:   (cb)  => ipcRenderer.on('update-available',  () => cb()),
  onUpdateDownloaded:  (cb)  => ipcRenderer.on('update-downloaded', () => cb()),
  getLicenseKey:       ()    => ipcRenderer.invoke('get-license-key'),
});
