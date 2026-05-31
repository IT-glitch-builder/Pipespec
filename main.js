/**
 * EdgeWay PipeSpec — Electron hovedproces
 */

const { app, BrowserWindow, shell, dialog, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

const IS_DEV = !app.isPackaged;

const License = require('./license.js');

// Sæt version og userData-sti så server.js kan bruge dem korrekt uanset dev/prod
process.env.APP_VERSION  = app.getVersion();
process.env.APP_USERDATA = app.getPath('userData');

// ── Én instans ad gangen ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

// ── Start Express in-process (kun i produktion) ───────────────────────────────
let serverStarted = false;
function startServer() {
  if (serverStarted || IS_DEV) return;
  serverStarted = true;
  try {
    require('./server.js');
  } catch (err) {
    dialog.showErrorBox('Server-fejl', `Kunne ikke starte intern server:\n${err.message}`);
  }
}

// ── Vent på at serveren svarer ────────────────────────────────────────────────
function waitForServer(url, retries, delay, cb) {
  http.get(url, () => cb(null)).on('error', () => {
    if (retries <= 0) return cb(new Error('Server svarede ikke'));
    setTimeout(() => waitForServer(url, retries - 1, delay, cb), delay);
  });
}

// ── Vinduer ───────────────────────────────────────────────────────────────────
let mainWindow    = null;
let licenseWindow = null;

function openLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width:           480,
    height:          520,
    resizable:       false,
    title:           'EdgeWay PipeSpec — Aktivering',
    icon:            path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
    },
    show:            false,
    backgroundColor: '#0f1923',
  });
  licenseWindow.setMenuBarVisibility(false);
  licenseWindow.loadURL('http://localhost:3001/license-screen.html');
  licenseWindow.once('ready-to-show', () => { licenseWindow.show(); licenseWindow.focus(); });
  licenseWindow.on('closed', () => { licenseWindow = null; });
}

function openMainWindow() {
  mainWindow = new BrowserWindow({
    width:     1400,
    height:    900,
    minWidth:  900,
    minHeight: 600,
    title:     'EdgeWay PipeSpec',
    icon:      path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
    },
    show:            false,
    backgroundColor: '#0f1923',
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL('http://localhost:3001/PipeSpec.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    if (!IS_DEV) {
      autoUpdater.checkForUpdatesAndNotify();
      setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 30 * 60 * 1000);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('license-activate', async (_e, key) => License.activateKey(key));
ipcMain.handle('get-hwid',  () => License.getMachineId());
ipcMain.handle('get-version', () => app.getVersion());

ipcMain.on('license-activated', () => {
  if (licenseWindow) { licenseWindow.close(); licenseWindow = null; }
  openMainWindow();
});

// ── Auto-updater ──────────────────────────────────────────────────────────────
autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', err => console.error('Auto-updater:', err.message));

ipcMain.on('restart-and-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── App livscyklus ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (IS_DEV) await session.defaultSession.clearCache();
  startServer();

  waitForServer('http://localhost:3001/PipeSpec.html', 20, 500, (err) => {
    if (err) {
      dialog.showErrorBox('Timeout', 'Serveren startede ikke.\nGenstart appen eller kontakt support.');
      app.quit();
      return;
    }
    const license = License.loadLicense();
    if (license && license.valid) openMainWindow();
    else openLicenseWindow();
  });
});

app.on('second-instance', () => {
  const win = mainWindow || licenseWindow;
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const license = License.loadLicense();
    if (license && license.valid) openMainWindow();
    else openLicenseWindow();
  }
});
