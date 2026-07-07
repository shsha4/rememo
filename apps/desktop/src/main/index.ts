import { app, BrowserWindow, protocol, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipc';
import { setupAssetProtocol, ASSET_PROTOCOL } from './protocol/asset-protocol';
import { indexerService } from './services/indexer.service';
import { databaseService } from './services/database.service';
import { todoService } from './services/todo.service';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 커스텀 스킴은 app ready 이전에 privileged로 등록해야 <img>/fetch에서 로드 가능하다.
protocol.registerSchemesAsPrivileged([
  // <img> 로딩에 필요한 최소 권한만 부여한다 (fetch/CSP 우회는 불필요).
  { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true } },
]);

// 창 아이콘·Dock 아이콘이 공유하는 단일 경로 해석기.
// Windows 시작표시줄은 멀티사이즈 .ico를 선호(PNG는 기본 로고로 폴백하는 경우가 있음),
// macOS Dock은 nativeImage(.png)를 쓴다.
// dev는 소스 트리의 build/, prod는 asarUnpack된 build/(package.json files·asarUnpack에 포함)를 참조한다.
function resolveIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return isDev
    ? path.join(__dirname, `../../build/${iconFile}`)
    : path.join(process.resourcesPath, `app.asar.unpacked/build/${iconFile}`);
}

function createWindow() {
  const iconPath = resolveIconPath();

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

  // 네비게이션 가드: rememo는 라우터 없는 단일 페이지 앱이라 창 자체가 다른 주소로 이동하면
  // React 앱이 통째로 사라져 빈 하얀 화면이 된다(복구 불가). 프리뷰의 링크 클릭 등으로 인한
  // 창 이동을 모두 차단하고, 외부 http(s) 링크만 시스템 브라우저로 위임한다.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 동일 URL로의 이동(예: dev HMR 실패 시 Vite의 location.reload() 전체 리로드)은 허용한다.
    // 그 외의 창 이동(링크 클릭 등)은 모두 차단한다.
    if (url === mainWindow?.webContents.getURL()) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
  });

  // target=_blank / window.open도 새 창 대신 시스템 브라우저로 보내고 앱 창 생성은 막는다.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
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
  // Windows에서 시스템 알림이 앱 신원과 함께 뜨도록 AppUserModelId를 지정한다.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.rememo.desktop');
  }

  // macOS Dock 아이콘은 BrowserWindow.icon으로 설정되지 않으므로(무시됨)
  // app.dock.setIcon으로 직접 지정한다. dev/prod 모두 적용.
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = resolveIconPath();
    if (fs.existsSync(iconPath)) {
      const dockIcon = nativeImage.createFromPath(iconPath);
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon);
      }
    }
  }

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

  // Stop todo notification scheduler
  try {
    todoService.stopAll();
  } catch (error) {
    console.error('Error stopping todo scheduler:', error);
  }

  // Close databases
  try {
    databaseService.closeAllDatabases();
  } catch (error) {
    console.error('Error closing databases:', error);
  }

  console.log('Cleanup complete');
}
