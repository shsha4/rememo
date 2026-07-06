import { ipcMain } from 'electron';
import { noteService } from '../services/note.service';
import { indexerService } from '../services/indexer.service';
import type {
  NoteCreateRequest,
  NoteReadRequest,
  NoteUpdateRequest,
  NoteDeleteRequest,
  NoteListRequest,
  NoteRenameRequest,
  NoteGetTitleRequest,
  NoteGetRelativePathRequest,
} from '../../shared/ipc';

export function setupNoteHandlers() {
  ipcMain.handle('note:create', async (_event, req: NoteCreateRequest) => {
    const { input, vaultPath } = req;
    const note = await noteService.createNote(input);

    // 방금 앱이 쓴 파일이므로 watcher의 add 이벤트를 무시하게 표시(중복 reindex 방지)
    indexerService.markInternalChange(note.path);

    // Explicitly trigger re-indexing for the new note
    try {
      console.log('[note:create] Triggering re-index for new note:', note.path);
      await indexerService.indexNote(note.path, vaultPath, input.vaultId);
      await indexerService.reindexAllNotesLinks(vaultPath, input.vaultId);
    } catch (error) {
      console.error('[note:create] Failed to trigger re-index:', error);
    }

    return note;
  });

  ipcMain.handle('note:read', async (_event, req: NoteReadRequest) => {
    const { notePath, vaultId } = req;
    return noteService.readNote(notePath, vaultId);
  });

  ipcMain.handle('note:update', async (_event, req: NoteUpdateRequest) => {
    const { notePath, vaultId, update, vaultPath } = req;
    const note = await noteService.updateNote(notePath, vaultId, update);

    // 방금 앱이 쓴 파일이므로 watcher의 change 이벤트를 무시하게 표시(중복 reindex 방지)
    indexerService.markInternalChange(notePath);

    // Explicitly trigger re-indexing for the updated note
    try {
      console.log('[note:update] Triggering re-index for updated note:', notePath);
      await indexerService.reindexNote(notePath, vaultPath, vaultId);
      await indexerService.reindexAllNotesLinks(vaultPath, vaultId);
    } catch (error) {
      console.error('[note:update] Failed to trigger re-index:', error);
    }

    return note;
  });

  ipcMain.handle('note:delete', async (_event, req: NoteDeleteRequest) => {
    const { notePath, vaultPath } = req;
    await noteService.deleteNote(notePath);

    // 방금 앱이 지운 파일이므로 watcher의 unlink 이벤트를 무시하게 표시(중복 처리 방지)
    indexerService.markInternalChange(notePath);

    // Explicitly trigger index cleanup for the deleted note
    try {
      console.log('[note:delete] Triggering index cleanup for deleted note:', notePath);
      await indexerService.deleteNoteFromIndex(notePath, vaultPath);
    } catch (error) {
      console.error('[note:delete] Failed to trigger index cleanup:', error);
    }
  });

  ipcMain.handle('note:list', async (_event, req: NoteListRequest) => {
    const { vaultPath } = req;
    return noteService.listNotes(vaultPath);
  });

  ipcMain.handle('note:rename', async (_event, req: NoteRenameRequest) => {
    const { oldPath, newPath, vaultPath, vaultId } = req;
    await noteService.renameNote(oldPath, newPath);

    // rename은 파일시스템에서 unlink(old)+add(new)로 나타나므로 양쪽 모두 표시(중복 처리 방지)
    indexerService.markInternalChange(oldPath);
    indexerService.markInternalChange(newPath);

    // Explicitly trigger index update for the renamed note
    try {
      console.log(
        '[note:rename] Triggering index update for renamed note:',
        oldPath,
        '->',
        newPath,
      );
      // Delete old note from index
      await indexerService.deleteNoteFromIndex(oldPath, vaultPath);
      // Index the new note
      await indexerService.indexNote(newPath, vaultPath, vaultId);
      // Re-index all links since links might reference the renamed note
      await indexerService.reindexAllNotesLinks(vaultPath, vaultId);
    } catch (error) {
      console.error('[note:rename] Failed to trigger index update:', error);
    }
  });

  ipcMain.handle('note:get-title', async (_event, req: NoteGetTitleRequest) => {
    const { notePath } = req;
    return noteService.getNoteTitleFromPath(notePath);
  });

  ipcMain.handle('note:get-relative-path', async (_event, req: NoteGetRelativePathRequest) => {
    const { notePath, vaultPath } = req;
    return noteService.getNoteRelativePath(notePath, vaultPath);
  });
}
