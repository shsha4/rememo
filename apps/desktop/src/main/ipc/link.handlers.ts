import { ipcMain } from 'electron';
import { ipcHandler } from './ipc-result';
import { linkService } from '../services/link.service';
import { indexerService } from '../services/indexer.service';
import type { LinkAddRequest, LinkRemoveRequest } from '../../shared/ipc';

// source 노트 파일이 변경됐으므로 인덱스를 갱신한다.
// note:update와 동일한 패턴: markInternalChange로 watcher 중복 재인덱싱을 막고,
// 해당 노트 + 전체 링크를 재인덱싱해 그래프/역링크에 즉시 반영한다.
async function reindexAfterLinkChange(
  sourceNotePath: string,
  vaultPath: string,
  vaultId: string,
): Promise<void> {
  indexerService.markInternalChange(sourceNotePath);
  try {
    await indexerService.reindexNote(sourceNotePath, vaultPath, vaultId);
    await indexerService.reindexAllNotesLinks(vaultPath, vaultId);
  } catch (error) {
    console.error('[link] Failed to trigger re-index:', error);
  }
}

export function setupLinkHandlers() {
  ipcMain.handle(
    'link:add',
    ipcHandler(async (_event, req: LinkAddRequest) => {
      const { sourceNotePath, targetTitle, vaultId, vaultPath } = req;
      const note = await linkService.addLink(sourceNotePath, targetTitle, vaultId);
      await reindexAfterLinkChange(sourceNotePath, vaultPath, vaultId);
      return note;
    }),
  );

  ipcMain.handle(
    'link:remove',
    ipcHandler(async (_event, req: LinkRemoveRequest) => {
      const { sourceNotePath, targetTitle, vaultId, vaultPath } = req;
      const note = await linkService.removeLink(sourceNotePath, targetTitle, vaultId);
      await reindexAfterLinkChange(sourceNotePath, vaultPath, vaultId);
      return note;
    }),
  );
}
