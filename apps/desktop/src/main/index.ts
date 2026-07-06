import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipc';
import { setupAssetProtocol, ASSET_PROTOCOL } from './protocol/asset-protocol';
import { indexerService } from './services/indexer.service';
import { databaseService } from './services/database.service';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 커스텀 스킴은 app ready 이전에 privileged로 등록해야 <img>/fetch에서 로드 가능하다.
protocol.registerSchemesAsPrivileged([
  // <img> 로딩에 필요한 최소 권한만 부여한다 (fetch/CSP 우회는 불필요).
  { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true } },
]);

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../../build/icon.png')
    : path.join(process.resourcesPath, 'app.asar.unpacked/build/icon.png');

  // Only pass the icon when the file actually exists — a missing path makes
  // macOS crash with SIGTRAP when constructing the BrowserWindow.
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'rememo',
    ...(iconExists ? { icon: iconPath } : {}),
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
  setupAssetProtocol();
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

app.on('before-quit', () => {
  cleanup();
});

app.on('will-quit', () => {
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
