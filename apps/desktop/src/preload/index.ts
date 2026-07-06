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
import type { IpcResult } from '../shared/ipc';

// 와이어에서 IpcResult<T> 봉투를 벗겨 성공 시 data(T)를 반환하고,
// 실패 시 error.code를 name으로 갖는 Error를 throw한다.
async function invoke<T>(channel: string, req?: unknown): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, req)) as IpcResult<T>;
  if (!res.success) {
    const err = new Error(res.error.message);
    err.name = res.error.code;
    throw err;
  }
  return res.data;
}

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
  ping: () => invoke<string>('ping'),
  system: {
    getPlatform: () => invoke<string>('system:get-platform'),
  },
  vault: {
    selectFolder: () => invoke<string | null>('vault:select-folder'),
    create: (req) => invoke<Vault>('vault:create', req),
    open: (req) => invoke<Vault>('vault:open', req),
    isValid: (req) => invoke<boolean>('vault:is-valid', req),
    updateConfig: (req) => invoke<void>('vault:update-config', req),
  },
  note: {
    create: (req) => invoke<Note>('note:create', req),
    read: (req) => invoke<Note>('note:read', req),
    update: (req) => invoke<Note>('note:update', req),
    delete: (req) => invoke<void>('note:delete', req),
    list: (req) => invoke<string[]>('note:list', req),
    rename: (req) => invoke<void>('note:rename', req),
    getTitle: (req) => invoke<string>('note:get-title', req),
    getRelativePath: (req) => invoke<string>('note:get-relative-path', req),
  },
  indexer: {
    indexVault: (req) => invoke<void>('indexer:index-vault', req),
    getBacklinks: (req) => invoke<unknown[]>('indexer:get-backlinks', req),
    searchNotes: (req) => invoke<unknown[]>('indexer:search-notes', req),
    searchByTag: (req) => invoke<unknown[]>('indexer:search-by-tag', req),
    getAllTags: (req) => invoke<string[]>('indexer:get-all-tags', req),
    getGraphData: (req) =>
      invoke<{ nodes: unknown[]; edges: unknown[] }>('indexer:get-graph-data', req),
    startWatching: (req) => invoke<void>('indexer:start-watching', req),
    stopWatching: (req) => invoke<void>('indexer:stop-watching', req),
  },
  sync: {
    authenticate: () => invoke<boolean>('sync:authenticate'),
    isAuthenticated: () => invoke<boolean>('sync:is-authenticated'),
    signOut: () => invoke<void>('sync:sign-out'),
    backupVault: (req) => invoke<string>('sync:backup-vault', req),
    listBackups: () =>
      invoke<Array<{ id: string; name: string; createdAt: Date }>>('sync:list-backups'),
    deleteBackup: (req) => invoke<void>('sync:delete-backup', req),
    restoreVault: (req) => invoke<void>('sync:restore-vault', req),
  },
  asset: {
    saveImage: (req) => invoke<string>('asset:save-image', req),
  },
  todo: {
    list: (req) => invoke<TodoItem[]>('todo:list', req),
    toggle: (req) => invoke<boolean | null>('todo:toggle', req),
    setDue: (req) => invoke<void>('todo:set-due', req),
    updateSettings: (req) => invoke<void>('todo:update-settings', req),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
