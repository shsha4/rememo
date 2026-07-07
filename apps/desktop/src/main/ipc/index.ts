import { ipcMain } from 'electron';
import { ipcHandler } from './ipc-result';
import { setupVaultHandlers } from './vault.handlers';
import { setupNoteHandlers } from './note.handlers';
import { setupLinkHandlers } from './link.handlers';
import { setupCategoryHandlers } from './category.handlers';
import { setupIndexerHandlers } from './indexer.handlers';
import { setupSyncHandlers } from './sync.handlers';
import { setupAssetHandlers } from './asset.handlers';
import { setupTodoHandlers } from './todo.handlers';

export function setupIpcHandlers() {
  // Ping-Pong test handler
  ipcMain.handle(
    'ping',
    ipcHandler(async () => {
      return 'pong';
    }),
  );

  // System handlers
  ipcMain.handle(
    'system:get-platform',
    ipcHandler(async () => {
      return process.platform;
    }),
  );

  // Vault handlers
  setupVaultHandlers();

  // Note handlers
  setupNoteHandlers();

  // Link handlers (그래프에서 노드 간 관계 추가/삭제)
  setupLinkHandlers();

  // Category handlers (폴더 기반 카테고리 생성/이름변경/삭제)
  setupCategoryHandlers();

  // Indexer handlers
  setupIndexerHandlers();

  // Sync handlers (Google Drive)
  setupSyncHandlers();

  // Asset handlers (이미지 저장)
  setupAssetHandlers();

  // Todo handlers (체크박스 할 일 + 마감 알림)
  setupTodoHandlers();
}
