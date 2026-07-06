import { contextBridge, ipcRenderer } from 'electron';
import type { Vault } from '@memograph/core';
import type { Note } from '@memograph/core';
import type {
  VaultCreateRequest,
  VaultOpenRequest,
  VaultIsValidRequest,
  VaultUpdateConfigRequest,
  NoteCreateRequest,
  NoteReadRequest,
  NoteUpdateRequest,
  NoteDeleteRequest,
  NoteListRequest,
  NoteRenameRequest,
  NoteGetTitleRequest,
  NoteGetRelativePathRequest,
  IndexerIndexVaultRequest,
  IndexerGetBacklinksRequest,
  IndexerSearchNotesRequest,
  IndexerSearchByTagRequest,
  IndexerGetAllTagsRequest,
  IndexerGetGraphDataRequest,
  IndexerStartWatchingRequest,
  IndexerStopWatchingRequest,
  SyncBackupVaultRequest,
  SyncDeleteBackupRequest,
  SyncRestoreVaultRequest,
  AssetSaveImageRequest,
  TodoListRequest,
  TodoToggleRequest,
  TodoSetDueRequest,
  TodoUpdateSettingsRequest,
} from '../shared/ipc';

export interface TodoItem {
  notePath: string;
  noteTitle: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  hasTime: boolean;
  line: number;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  system: {
    getPlatform: () => Promise<string>;
  };
  vault: {
    selectFolder: () => Promise<string | null>;
    create: (req: VaultCreateRequest) => Promise<Vault>;
    open: (req: VaultOpenRequest) => Promise<Vault>;
    isValid: (req: VaultIsValidRequest) => Promise<boolean>;
    updateConfig: (req: VaultUpdateConfigRequest) => Promise<void>;
  };
  note: {
    create: (req: NoteCreateRequest) => Promise<Note>;
    read: (req: NoteReadRequest) => Promise<Note>;
    update: (req: NoteUpdateRequest) => Promise<Note>;
    delete: (req: NoteDeleteRequest) => Promise<void>;
    list: (req: NoteListRequest) => Promise<string[]>;
    rename: (req: NoteRenameRequest) => Promise<void>;
    getTitle: (req: NoteGetTitleRequest) => Promise<string>;
    getRelativePath: (req: NoteGetRelativePathRequest) => Promise<string>;
  };
  indexer: {
    indexVault: (req: IndexerIndexVaultRequest) => Promise<void>;
    getBacklinks: (req: IndexerGetBacklinksRequest) => Promise<any[]>;
    searchNotes: (req: IndexerSearchNotesRequest) => Promise<any[]>;
    searchByTag: (req: IndexerSearchByTagRequest) => Promise<any[]>;
    getAllTags: (req: IndexerGetAllTagsRequest) => Promise<string[]>;
    getGraphData: (req: IndexerGetGraphDataRequest) => Promise<{ nodes: any[]; edges: any[] }>;
    startWatching: (req: IndexerStartWatchingRequest) => Promise<void>;
    stopWatching: (req: IndexerStopWatchingRequest) => Promise<void>;
  };
  sync: {
    authenticate: () => Promise<boolean>;
    isAuthenticated: () => Promise<boolean>;
    signOut: () => Promise<void>;
    backupVault: (req: SyncBackupVaultRequest) => Promise<string>;
    listBackups: () => Promise<Array<{ id: string; name: string; createdAt: Date }>>;
    deleteBackup: (req: SyncDeleteBackupRequest) => Promise<void>;
    restoreVault: (req: SyncRestoreVaultRequest) => Promise<void>;
  };
  asset: {
    saveImage: (req: AssetSaveImageRequest) => Promise<string>;
  };
  todo: {
    list: (req: TodoListRequest) => Promise<TodoItem[]>;
    toggle: (req: TodoToggleRequest) => Promise<boolean | null>;
    setDue: (req: TodoSetDueRequest) => Promise<void>;
    updateSettings: (req: TodoUpdateSettingsRequest) => Promise<void>;
  };
}

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  system: {
    getPlatform: () => ipcRenderer.invoke('system:get-platform'),
  },
  vault: {
    selectFolder: () => ipcRenderer.invoke('vault:select-folder'),
    create: (req) => ipcRenderer.invoke('vault:create', req),
    open: (req) => ipcRenderer.invoke('vault:open', req),
    isValid: (req) => ipcRenderer.invoke('vault:is-valid', req),
    updateConfig: (req) => ipcRenderer.invoke('vault:update-config', req),
  },
  note: {
    create: (req) => ipcRenderer.invoke('note:create', req),
    read: (req) => ipcRenderer.invoke('note:read', req),
    update: (req) => ipcRenderer.invoke('note:update', req),
    delete: (req) => ipcRenderer.invoke('note:delete', req),
    list: (req) => ipcRenderer.invoke('note:list', req),
    rename: (req) => ipcRenderer.invoke('note:rename', req),
    getTitle: (req) => ipcRenderer.invoke('note:get-title', req),
    getRelativePath: (req) => ipcRenderer.invoke('note:get-relative-path', req),
  },
  indexer: {
    indexVault: (req) => ipcRenderer.invoke('indexer:index-vault', req),
    getBacklinks: (req) => ipcRenderer.invoke('indexer:get-backlinks', req),
    searchNotes: (req) => ipcRenderer.invoke('indexer:search-notes', req),
    searchByTag: (req) => ipcRenderer.invoke('indexer:search-by-tag', req),
    getAllTags: (req) => ipcRenderer.invoke('indexer:get-all-tags', req),
    getGraphData: (req) => ipcRenderer.invoke('indexer:get-graph-data', req),
    startWatching: (req) => ipcRenderer.invoke('indexer:start-watching', req),
    stopWatching: (req) => ipcRenderer.invoke('indexer:stop-watching', req),
  },
  sync: {
    authenticate: () => ipcRenderer.invoke('sync:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('sync:is-authenticated'),
    signOut: () => ipcRenderer.invoke('sync:sign-out'),
    backupVault: (req) => ipcRenderer.invoke('sync:backup-vault', req),
    listBackups: () => ipcRenderer.invoke('sync:list-backups'),
    deleteBackup: (req) => ipcRenderer.invoke('sync:delete-backup', req),
    restoreVault: (req) => ipcRenderer.invoke('sync:restore-vault', req),
  },
  asset: {
    saveImage: (req) => ipcRenderer.invoke('asset:save-image', req),
  },
  todo: {
    list: (req) => ipcRenderer.invoke('todo:list', req),
    toggle: (req) => ipcRenderer.invoke('todo:toggle', req),
    setDue: (req) => ipcRenderer.invoke('todo:set-due', req),
    updateSettings: (req) => ipcRenderer.invoke('todo:update-settings', req),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
