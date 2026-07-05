import { ipcMain } from 'electron';
import { noteService } from '../services/note.service';
import type { NoteCreateInput, NoteUpdateInput } from '../domain/note';

export function setupNoteHandlers() {
  ipcMain.handle('note:create', async (_event, input: NoteCreateInput) => {
    return noteService.createNote(input);
  });

  ipcMain.handle('note:read', async (_event, notePath: string, vaultId: string) => {
    return noteService.readNote(notePath, vaultId);
  });

  ipcMain.handle('note:update', async (_event, notePath: string, vaultId: string, update: NoteUpdateInput) => {
    return noteService.updateNote(notePath, vaultId, update);
  });

  ipcMain.handle('note:delete', async (_event, notePath: string) => {
    return noteService.deleteNote(notePath);
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
