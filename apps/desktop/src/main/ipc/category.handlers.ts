import { ipcMain } from 'electron';
import path from 'path';
import { normalizeNotePath } from '@memograph/core';
import { ipcHandler } from './ipc-result';
import { categoryService } from '../services/category.service';
import { indexerService } from '../services/indexer.service';
import type {
  CategoryListRequest,
  CategoryCreateRequest,
  CategoryRenameRequest,
  CategoryDeleteRequest,
} from '../../shared/ipc';

export function setupCategoryHandlers() {
  ipcMain.handle(
    'category:list',
    ipcHandler(async (_event, req: CategoryListRequest) => {
      const { vaultPath, notesDir } = req;
      const baseDir = notesDir ? path.join(vaultPath, notesDir) : vaultPath;
      return categoryService.listFolders(baseDir);
    }),
  );

  ipcMain.handle(
    'category:create',
    ipcHandler(async (_event, req: CategoryCreateRequest) => {
      // 빈 카테고리 생성은 노트를 건드리지 않으므로 재인덱싱이 필요 없다.
      // 앱이 방금 만든 폴더이므로 watcher의 addDir 이벤트를 무시하게 표시(초기 창은 직접 갱신).
      indexerService.markInternalChange(req.dirPath);
      await categoryService.createCategory(req.dirPath);
    }),
  );

  ipcMain.handle(
    'category:rename',
    ipcHandler(async (_event, req: CategoryRenameRequest) => {
      const { oldPath, newPath, vaultPath, vaultId } = req;

      // 폴더 이름변경은 하위 노트들의 경로를 한꺼번에 바꾼다. 각 노트의 old/new 경로를 미리 구해
      // watcher의 뒤이은 unlink/add 이벤트를 억제(중복 재인덱싱 방지)한다(note:rename과 동일 패턴).
      const oldNorm = normalizeNotePath(oldPath);
      const newNorm = normalizeNotePath(newPath);
      const affected = await categoryService.listNotesUnder(oldPath);

      await categoryService.renameCategory(oldPath, newPath);

      // 폴더 자체(old/new)의 unlinkDir/addDir 이벤트도 앱 변경이므로 억제한다.
      indexerService.markInternalChange(oldPath);
      indexerService.markInternalChange(newPath);
      for (const notePath of affected) {
        const moved = newNorm + notePath.slice(oldNorm.length);
        indexerService.markInternalChange(notePath);
        indexerService.markInternalChange(moved);
      }

      // 다수 노트 경로가 한 번에 바뀌므로 vault 전체를 재빌드해 orphan 없이 일관성을 맞춘다
      // (DB는 파생 캐시라 재빌드가 안전하다). WikiLink는 제목 기반이라 폴더 이동에도 깨지지 않는다.
      try {
        await indexerService.indexVault(vaultPath, vaultId);
      } catch (error) {
        console.error('[category:rename] Failed to reindex vault:', error);
      }
    }),
  );

  ipcMain.handle(
    'category:delete',
    ipcHandler(async (_event, req: CategoryDeleteRequest) => {
      // 빈 카테고리만 삭제 가능(서비스가 강제). 노트가 없으므로 재인덱싱이 필요 없다.
      // 앱이 지운 폴더이므로 watcher의 unlinkDir 이벤트를 무시하게 표시한다.
      indexerService.markInternalChange(req.dirPath);
      await categoryService.deleteCategory(req.dirPath);
    }),
  );
}
