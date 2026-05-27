/**
 * EdgeWay PipeSpec — Electron hovedproces
 *
 * DEV:  npm run dev  → åbner localhost:3001 (Express kører separat)
 * PROD: npm run build → pakker alt i .exe, Express kører in-process
 */

const { app, BrowserWindow, shell, dialog, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

const IS_DEV = !app.isPackaged;

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
    console.log('PipeSpec server startet på port 3001');
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

// ── Vindue ────────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
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

  // Åbn eksterne links i systemets browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.setMenuBarVisibility(false);

  // DEV: brug localhost (Express kører separat med `node server.js`)
  // PROD: brug den interne server
  mainWindow.loadURL('http://localhost:3001/PipeSpec.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // Tjek for opdateringer i produktion
    if (!IS_DEV) {
      autoUpdater.checkForUpdatesAndNotify();
    } else {
      console.log('DEV mode — auto-update deaktiveret');
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Auto-updater events ───────────────────────────────────────────────────────
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type:    'info',
    title:   'Opdatering tilgængelig',
    message: 'En ny version af PipeSpec er tilgængelig.\nDen hentes i baggrunden og installeres næste gang du lukker appen.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type:    'info',
    title:   'Opdatering klar',
    message: 'Opdateringen er downloadet.\nGenstart appen for at installere den nye version.',
    buttons: ['Genstart nu', 'Senere']
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater fejl:', err.message);
});

// ── App livscyklus ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Ryd cache i dev så ændringer altid vises
  if (IS_DEV) await session.defaultSession.clearCache();

  startServer(); // Ingen effekt i dev

  waitForServer('http://localhost:3001/PipeSpec.html', 20, 500, (err) => {
    if (err) {
      dialog.showErrorBox('Timeout', 'Serveren startede ikke i tide.\nKør "node server.js" i terminalen først (dev), eller prøv at genstarte appen.');
      app.quit();
      return;
    }
    createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
