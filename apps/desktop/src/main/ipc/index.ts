import { ipcMain } from 'electron';
import { setupVaultHandlers } from './vault.handlers';
import { setupNoteHandlers } from './note.handlers';
import { setupIndexerHandlers } from './indexer.handlers';
import { setupSyncHandlers } from './sync.handlers';

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

  // Indexer handlers
  setupIndexerHandlers();

  // Sync handlers (Google Drive)
  setupSyncHandlers();
}
