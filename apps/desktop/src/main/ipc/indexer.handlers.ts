import { ipcMain } from 'electron';
import { ipcHandler } from './ipc-result';
import { indexerService } from '../services/indexer.service';
import { todoService } from '../services/todo.service';
import type {
  IndexerIndexVaultRequest,
  IndexerGetBacklinksRequest,
  IndexerSearchNotesRequest,
  IndexerSearchByTagRequest,
  IndexerGetAllTagsRequest,
  IndexerGetGraphDataRequest,
  IndexerStartWatchingRequest,
  IndexerStopWatchingRequest,
} from '../../shared/ipc';

export function setupIndexerHandlers() {
  ipcMain.handle(
    'indexer:index-vault',
    ipcHandler(async (_event, req: IndexerIndexVaultRequest) => {
      const { vaultPath, vaultId } = req;
      await indexerService.indexVault(vaultPath, vaultId);

      // 인덱싱이 끝나면 할 일 마감 알림 스케줄러에 이 볼트를 등록한다(부수효과, 실패 무시).
      try {
        await todoService.registerVault(vaultPath);
      } catch (error) {
        console.error('[indexer:index-vault] Failed to register todo scheduler:', error);
      }
    }),
  );

  ipcMain.handle(
    'indexer:get-backlinks',
    ipcHandler(async (_event, req: IndexerGetBacklinksRequest) => {
      const { vaultPath, notePath } = req;
      return indexerService.getBacklinks(vaultPath, notePath);
    }),
  );

  ipcMain.handle(
    'indexer:search-notes',
    ipcHandler(async (_event, req: IndexerSearchNotesRequest) => {
      const { vaultPath, query } = req;
      return indexerService.searchNotes(vaultPath, query);
    }),
  );

  ipcMain.handle(
    'indexer:search-by-tag',
    ipcHandler(async (_event, req: IndexerSearchByTagRequest) => {
      const { vaultPath, tag } = req;
      return indexerService.searchByTag(vaultPath, tag);
    }),
  );

  ipcMain.handle(
    'indexer:get-all-tags',
    ipcHandler(async (_event, req: IndexerGetAllTagsRequest) => {
      const { vaultPath } = req;
      return indexerService.getAllTags(vaultPath);
    }),
  );

  ipcMain.handle(
    'indexer:get-graph-data',
    ipcHandler(async (_event, req: IndexerGetGraphDataRequest) => {
      const { vaultPath } = req;
      return indexerService.getGraphData(vaultPath);
    }),
  );

  ipcMain.handle(
    'indexer:start-watching',
    ipcHandler(async (_event, req: IndexerStartWatchingRequest) => {
      const { vaultPath, vaultId } = req;
      indexerService.startWatching(vaultPath, vaultId);
    }),
  );

  ipcMain.handle(
    'indexer:stop-watching',
    ipcHandler(async (_event, req: IndexerStopWatchingRequest) => {
      const { vaultPath } = req;
      indexerService.stopWatching(vaultPath);
      todoService.unregisterVault(vaultPath);
    }),
  );
}
