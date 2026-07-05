export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  SYNCING = 'syncing',
  ERROR = 'error',
  CONFLICT = 'conflict',
}

export interface SyncState {
  id: string;
  localPath: string;
  localHash: string;
  driveFileId?: string;
  driveRevisionId?: string;
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  errorMessage?: string;
}

export interface SyncConflict {
  localPath: string;
  localContent: string;
  remoteContent: string;
  localModifiedAt: Date;
  remoteModifiedAt: Date;
}

export interface BackupResult {
  success: boolean;
  totalFiles: number;
  uploadedFiles: number;
  skippedFiles: number;
  errors: string[];
}

export interface ImportResult {
  success: boolean;
  totalFiles: number;
  downloadedFiles: number;
  skippedFiles: number;
  errors: string[];
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}
