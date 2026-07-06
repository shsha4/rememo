import { ipcMain } from 'electron';
import type { NotificationSettings } from '@memograph/core';
import { todoService } from '../services/todo.service';

export function setupTodoHandlers() {
  ipcMain.handle('todo:list', async (_event, vaultPath: string) => {
    return todoService.getTodos(vaultPath);
  });

  ipcMain.handle(
    'todo:toggle',
    async (_event, vaultPath: string, notePath: string, line: number, vaultId: string) => {
      return todoService.toggleTodo(vaultPath, notePath, line, vaultId);
    },
  );

  ipcMain.handle(
    'todo:set-due',
    async (
      _event,
      vaultPath: string,
      notePath: string,
      line: number,
      dueDate: string | null,
      vaultId: string,
    ) => {
      return todoService.setDueDate(vaultPath, notePath, line, dueDate, vaultId);
    },
  );

  ipcMain.handle(
    'todo:update-settings',
    async (_event, vaultPath: string, settings: NotificationSettings) => {
      return todoService.updateSettings(vaultPath, settings);
    },
  );
}
