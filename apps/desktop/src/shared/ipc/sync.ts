export interface SyncBackupVaultRequest {
  vaultPath: string;
}

export interface SyncDeleteBackupRequest {
  backupId: string;
}

export interface SyncRestoreVaultRequest {
  backupId: string;
  targetPath: string;
}
