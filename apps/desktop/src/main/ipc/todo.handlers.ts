import { ipcMain } from 'electron';
import { todoService } from '../services/todo.service';
import type {
  TodoListRequest,
  TodoToggleRequest,
  TodoSetDueRequest,
  TodoUpdateSettingsRequest,
} from '../../shared/ipc';

export function setupTodoHandlers() {
  ipcMain.handle('todo:list', async (_event, req: TodoListRequest) => {
    const { vaultPath } = req;
    return todoService.getTodos(vaultPath);
  });

  ipcMain.handle('todo:toggle', async (_event, req: TodoToggleRequest) => {
    const { vaultPath, notePath, line, vaultId } = req;
    return todoService.toggleTodo(vaultPath, notePath, line, vaultId);
  });

  ipcMain.handle('todo:set-due', async (_event, req: TodoSetDueRequest) => {
    const { vaultPath, notePath, line, dueDate, vaultId } = req;
    return todoService.setDueDate(vaultPath, notePath, line, dueDate, vaultId);
  });

  ipcMain.handle('todo:update-settings', async (_event, req: TodoUpdateSettingsRequest) => {
    const { vaultPath, settings } = req;
    return todoService.updateSettings(vaultPath, settings);
  });
}
