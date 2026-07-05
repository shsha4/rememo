import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { setupIpcHandlers } from './ipc';
import { indexerService } from './services/indexer.service';
import { databaseService } from './services/database.service';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Create app icon from SVG
const iconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:#667eea;stop-opacity:1'/><stop offset='100%' style='stop-color:#764ba2;stop-opacity:1'/></linearGradient></defs><circle cx='100' cy='100' r='90' fill='url(#grad)'/><text x='100' y='130' font-family='Arial,sans-serif' font-size='90' font-weight='bold' fill='white' text-anchor='middle'>r</text></svg>`;
const iconDataUrl = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
const appIcon = nativeImage.createFromDataURL(iconDataUrl);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'rememo',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Always quit on Windows/Linux
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('before-quit', (event) => {
  cleanup();
});

app.on('will-quit', (event) => {
  cleanup();
});

let isCleanedUp = false;
function cleanup() {
  if (isCleanedUp) return;
  isCleanedUp = true;

  console.log('Cleaning up resources...');

  // Stop file watchers
  try {
    indexerService.stopAllWatchers();
  } catch (error) {
    console.error('Error stopping watchers:', error);
  }

  // Close databases
  try {
    databaseService.closeAllDatabases();
  } catch (error) {
    console.error('Error closing databases:', error);
  }

  console.log('Cleanup complete');
}
