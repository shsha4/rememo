import { ipcMain } from 'electron';
import { indexerService } from '../services/indexer.service';
import { todoService } from '../services/todo.service';

export function setupIndexerHandlers() {
  ipcMain.handle('indexer:index-vault', async (_event, vaultPath: string, vaultId: string) => {
    await indexerService.indexVault(vaultPath, vaultId);

    // 인덱싱이 끝나면 할 일 마감 알림 스케줄러에 이 볼트를 등록한다(부수효과, 실패 무시).
    try {
      await todoService.registerVault(vaultPath);
    } catch (error) {
      console.error('[indexer:index-vault] Failed to register todo scheduler:', error);
    }
  });

  ipcMain.handle('indexer:get-backlinks', async (_event, vaultPath: string, notePath: string) => {
    return indexerService.getBacklinks(vaultPath, notePath);
  });

  ipcMain.handle('indexer:search-notes', async (_event, vaultPath: string, query: string) => {
    return indexerService.searchNotes(vaultPath, query);
  });

  ipcMain.handle('indexer:search-by-tag', async (_event, vaultPath: string, tag: string) => {
    return indexerService.searchByTag(vaultPath, tag);
  });

  ipcMain.handle('indexer:get-all-tags', async (_event, vaultPath: string) => {
    return indexerService.getAllTags(vaultPath);
  });

  ipcMain.handle('indexer:get-graph-data', async (_event, vaultPath: string) => {
    return indexerService.getGraphData(vaultPath);
  });

  ipcMain.handle('indexer:start-watching', async (_event, vaultPath: string, vaultId: string) => {
    indexerService.startWatching(vaultPath, vaultId);
  });

  ipcMain.handle('indexer:stop-watching', async (_event, vaultPath: string) => {
    indexerService.stopWatching(vaultPath);
    todoService.unregisterVault(vaultPath);
  });
}
