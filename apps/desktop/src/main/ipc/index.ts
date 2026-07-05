import { ipcMain } from 'electron';
import { setupVaultHandlers } from './vault.handlers';
import { setupNoteHandlers } from './note.handlers';

export function setupIpcHandlers() {
  // Ping-Pong test handler
  ipcMain.handle('ping', async () => {
    return 'pong';
  });

  // System handlers
  ipcMain.handle('system:get-platform', async () => {
    return process.platform;
  });

  // Vault handlers
  setupVaultHandlers();

  // Note handlers
  setupNoteHandlers();

  // TODO: Add more IPC handlers as we build features
  // - File handlers
  // - etc.
}
