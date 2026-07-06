// Re-export types from preload for use in renderer
// This avoids importing directly from main process

export interface Vault {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  config: VaultConfig;
}

export interface VaultConfig {
  /** vault.json에 영속되는 vault 고유 id (core의 VaultConfig와 동일). */
  id: string;
  version: string;
  name: string;
  defaultNoteLocation?: string;
  defaultAssetLocation?: string;
  notifications?: NotificationSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  defaultTime: string;
}

export interface Note {
  id: string;
  vaultId: string;
  title: string;
  path: string;
  content: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: NoteMetadata;
}

export interface NoteMetadata {
  tags?: string[];
  aliases?: string[];
  [key: string]: unknown;
}

export interface NoteCreateInput {
  vaultId: string;
  title: string;
  path: string;
  content?: string;
  metadata?: NoteMetadata;
}

export interface NoteUpdateInput {
  content?: string;
  metadata?: NoteMetadata;
}
