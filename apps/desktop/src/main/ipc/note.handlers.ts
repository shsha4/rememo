import { ipcMain } from 'electron';
import { noteService } from '../services/note.service';
import { indexerService } from '../services/indexer.service';
import type { NoteCreateInput, NoteUpdateInput } from '../domain/note';

export function setupNoteHandlers() {
  ipcMain.handle('note:create', async (_event, input: NoteCreateInput, vaultPath: string) => {
    const note = await noteService.createNote(input);

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

  ipcMain.handle('note:read', async (_event, notePath: string, vaultId: string) => {
    return noteService.readNote(notePath, vaultId);
  });

  ipcMain.handle('note:update', async (_event, notePath: string, vaultId: string, update: NoteUpdateInput, vaultPath: string) => {
    const note = await noteService.updateNote(notePath, vaultId, update);

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

  ipcMain.handle('note:delete', async (_event, notePath: string, vaultPath: string) => {
    await noteService.deleteNote(notePath);

    // Explicitly trigger index cleanup for the deleted note
    try {
      console.log('[note:delete] Triggering index cleanup for deleted note:', notePath);
      await indexerService.deleteNoteFromIndex(notePath, vaultPath);
    } catch (error) {
      console.error('[note:delete] Failed to trigger index cleanup:', error);
    }
  });

  ipcMain.handle('note:list', async (_event, vaultPath: string) => {
    return noteService.listNotes(vaultPath);
  });

  ipcMain.handle('note:rename', async (_event, oldPath: string, newPath: string) => {
    return noteService.renameNote(oldPath, newPath);
  });

  ipcMain.handle('note:get-title', async (_event, notePath: string) => {
    return noteService.getNoteTitleFromPath(notePath);
  });

  ipcMain.handle('note:get-relative-path', async (_event, notePath: string, vaultPath: string) => {
    return noteService.getNoteRelativePath(notePath, vaultPath);
  });
}
