import { ipcMain } from 'electron';
import { googleDriveService } from '../services/google-drive.service';

export function setupSyncHandlers() {
  // Google Drive Authentication
  ipcMain.handle('sync:authenticate', async () => {
    return googleDriveService.authenticate();
  });

  ipcMain.handle('sync:is-authenticated', async () => {
    return googleDriveService.isAuthenticated();
  });

  ipcMain.handle('sync:sign-out', async () => {
    return googleDriveService.signOut();
  });

  // Backup operations
  ipcMain.handle('sync:backup-vault', async (_event, vaultPath: string) => {
    return googleDriveService.backupVault(vaultPath);
  });

  ipcMain.handle('sync:list-backups', async () => {
    return googleDriveService.listBackups();
  });

  ipcMain.handle('sync:delete-backup', async (_event, backupId: string) => {
    return googleDriveService.deleteBackup(backupId);
  });

  // Restore operations
  ipcMain.handle('sync:restore-vault', async (_event, backupId: string, targetPath: string) => {
    return googleDriveService.restoreVault(backupId, targetPath);
  });
}
