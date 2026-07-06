import { ipcMain } from 'electron';
import { ipcHandler } from './ipc-result';
import { googleDriveService } from '../services/google-drive.service';
import type {
  SyncBackupVaultRequest,
  SyncDeleteBackupRequest,
  SyncRestoreVaultRequest,
} from '../../shared/ipc';

export function setupSyncHandlers() {
  // Google Drive Authentication
  ipcMain.handle(
    'sync:authenticate',
    ipcHandler(async () => {
      return googleDriveService.authenticate();
    }),
  );

  ipcMain.handle(
    'sync:is-authenticated',
    ipcHandler(async () => {
      return googleDriveService.isAuthenticated();
    }),
  );

  ipcMain.handle(
    'sync:sign-out',
    ipcHandler(async () => {
      return googleDriveService.signOut();
    }),
  );

  // Backup operations
  ipcMain.handle(
    'sync:backup-vault',
    ipcHandler(async (_event, req: SyncBackupVaultRequest) => {
      const { vaultPath } = req;
      return googleDriveService.backupVault(vaultPath);
    }),
  );

  ipcMain.handle(
    'sync:list-backups',
    ipcHandler(async () => {
      return googleDriveService.listBackups();
    }),
  );

  ipcMain.handle(
    'sync:delete-backup',
    ipcHandler(async (_event, req: SyncDeleteBackupRequest) => {
      const { backupId } = req;
      return googleDriveService.deleteBackup(backupId);
    }),
  );

  // Restore operations
  ipcMain.handle(
    'sync:restore-vault',
    ipcHandler(async (_event, req: SyncRestoreVaultRequest) => {
      const { backupId, targetPath } = req;
      return googleDriveService.restoreVault(backupId, targetPath);
    }),
  );
}
