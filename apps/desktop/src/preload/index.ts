import { contextBridge, ipcRenderer } from 'electron';
import type { Vault, VaultConfig, NotificationSettings } from '@memograph/core';
import type { Note, NoteCreateInput, NoteUpdateInput } from '@memograph/core';

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
    create: (vaultPath: string, name: string) => Promise<Vault>;
    open: (vaultPath: string) => Promise<Vault>;
    isValid: (vaultPath: string) => Promise<boolean>;
    updateConfig: (vaultPath: string, config: Partial<VaultConfig>) => Promise<void>;
  };
  note: {
    create: (input: NoteCreateInput, vaultPath: string) => Promise<Note>;
    read: (notePath: string, vaultId: string) => Promise<Note>;
    update: (
      notePath: string,
      vaultId: string,
      update: NoteUpdateInput,
      vaultPath: string,
    ) => Promise<Note>;
    delete: (notePath: string, vaultPath: string) => Promise<void>;
    list: (vaultPath: string) => Promise<string[]>;
    rename: (oldPath: string, newPath: string, vaultPath: string, vaultId: string) => Promise<void>;
    getTitle: (notePath: string) => Promise<string>;
    getRelativePath: (notePath: string, vaultPath: string) => Promise<string>;
  };
  indexer: {
    indexVault: (vaultPath: string, vaultId: string) => Promise<void>;
    getBacklinks: (vaultPath: string, notePath: string) => Promise<any[]>;
    searchNotes: (vaultPath: string, query: string) => Promise<any[]>;
    searchByTag: (vaultPath: string, tag: string) => Promise<any[]>;
    getAllTags: (vaultPath: string) => Promise<string[]>;
    getGraphData: (vaultPath: string) => Promise<{ nodes: any[]; edges: any[] }>;
    startWatching: (vaultPath: string, vaultId: string) => Promise<void>;
    stopWatching: (vaultPath: string) => Promise<void>;
  };
  sync: {
    authenticate: () => Promise<boolean>;
    isAuthenticated: () => Promise<boolean>;
    signOut: () => Promise<void>;
    backupVault: (vaultPath: string) => Promise<string>;
    listBackups: () => Promise<Array<{ id: string; name: string; createdAt: Date }>>;
    deleteBackup: (backupId: string) => Promise<void>;
    restoreVault: (backupId: string, targetPath: string) => Promise<void>;
  };
  asset: {
    saveImage: (
      vaultPath: string,
      data: Uint8Array,
      mime: string,
      originalName?: string,
    ) => Promise<string>;
  };
  todo: {
    list: (vaultPath: string) => Promise<TodoItem[]>;
    toggle: (
      vaultPath: string,
      notePath: string,
      line: number,
      vaultId: string,
    ) => Promise<boolean | null>;
    setDue: (
      vaultPath: string,
      notePath: string,
      line: number,
      dueDate: string | null,
      vaultId: string,
    ) => Promise<void>;
    updateSettings: (vaultPath: string, settings: NotificationSettings) => Promise<void>;
  };
}

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  system: {
    getPlatform: () => ipcRenderer.invoke('system:get-platform'),
  },
  vault: {
    selectFolder: () => ipcRenderer.invoke('vault:select-folder'),
    create: (vaultPath, name) => ipcRenderer.invoke('vault:create', vaultPath, name),
    open: (vaultPath) => ipcRenderer.invoke('vault:open', vaultPath),
    isValid: (vaultPath) => ipcRenderer.invoke('vault:is-valid', vaultPath),
    updateConfig: (vaultPath, config) =>
      ipcRenderer.invoke('vault:update-config', vaultPath, config),
  },
  note: {
    create: (input, vaultPath) => ipcRenderer.invoke('note:create', input, vaultPath),
    read: (notePath, vaultId) => ipcRenderer.invoke('note:read', notePath, vaultId),
    update: (notePath, vaultId, update, vaultPath) =>
      ipcRenderer.invoke('note:update', notePath, vaultId, update, vaultPath),
    delete: (notePath, vaultPath) => ipcRenderer.invoke('note:delete', notePath, vaultPath),
    list: (vaultPath) => ipcRenderer.invoke('note:list', vaultPath),
    rename: (oldPath, newPath, vaultPath, vaultId) =>
      ipcRenderer.invoke('note:rename', oldPath, newPath, vaultPath, vaultId),
    getTitle: (notePath) => ipcRenderer.invoke('note:get-title', notePath),
    getRelativePath: (notePath, vaultPath) =>
      ipcRenderer.invoke('note:get-relative-path', notePath, vaultPath),
  },
  indexer: {
    indexVault: (vaultPath, vaultId) =>
      ipcRenderer.invoke('indexer:index-vault', vaultPath, vaultId),
    getBacklinks: (vaultPath, notePath) =>
      ipcRenderer.invoke('indexer:get-backlinks', vaultPath, notePath),
    searchNotes: (vaultPath, query) => ipcRenderer.invoke('indexer:search-notes', vaultPath, query),
    searchByTag: (vaultPath, tag) => ipcRenderer.invoke('indexer:search-by-tag', vaultPath, tag),
    getAllTags: (vaultPath) => ipcRenderer.invoke('indexer:get-all-tags', vaultPath),
    getGraphData: (vaultPath) => ipcRenderer.invoke('indexer:get-graph-data', vaultPath),
    startWatching: (vaultPath, vaultId) =>
      ipcRenderer.invoke('indexer:start-watching', vaultPath, vaultId),
    stopWatching: (vaultPath) => ipcRenderer.invoke('indexer:stop-watching', vaultPath),
  },
  sync: {
    authenticate: () => ipcRenderer.invoke('sync:authenticate'),
    isAuthenticated: () => ipcRenderer.invoke('sync:is-authenticated'),
    signOut: () => ipcRenderer.invoke('sync:sign-out'),
    backupVault: (vaultPath) => ipcRenderer.invoke('sync:backup-vault', vaultPath),
    listBackups: () => ipcRenderer.invoke('sync:list-backups'),
    deleteBackup: (backupId) => ipcRenderer.invoke('sync:delete-backup', backupId),
    restoreVault: (backupId, targetPath) =>
      ipcRenderer.invoke('sync:restore-vault', backupId, targetPath),
  },
  asset: {
    saveImage: (vaultPath, data, mime, originalName) =>
      ipcRenderer.invoke('asset:save-image', vaultPath, data, mime, originalName),
  },
  todo: {
    list: (vaultPath) => ipcRenderer.invoke('todo:list', vaultPath),
    toggle: (vaultPath, notePath, line, vaultId) =>
      ipcRenderer.invoke('todo:toggle', vaultPath, notePath, line, vaultId),
    setDue: (vaultPath, notePath, line, dueDate, vaultId) =>
      ipcRenderer.invoke('todo:set-due', vaultPath, notePath, line, dueDate, vaultId),
    updateSettings: (vaultPath, settings) =>
      ipcRenderer.invoke('todo:update-settings', vaultPath, settings),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
