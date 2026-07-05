import { contextBridge, ipcRenderer } from 'electron';
import type { Vault, VaultConfig } from '../main/domain/vault';
import type { Note, NoteCreateInput, NoteUpdateInput } from '../main/domain/note';

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
    create: (input: NoteCreateInput) => Promise<Note>;
    read: (notePath: string, vaultId: string) => Promise<Note>;
    update: (notePath: string, vaultId: string, update: NoteUpdateInput) => Promise<Note>;
    delete: (notePath: string) => Promise<void>;
    list: (vaultPath: string) => Promise<string[]>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    getTitle: (notePath: string) => Promise<string>;
    getRelativePath: (notePath: string, vaultPath: string) => Promise<string>;
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
    updateConfig: (vaultPath, config) => ipcRenderer.invoke('vault:update-config', vaultPath, config),
  },
  note: {
    create: (input) => ipcRenderer.invoke('note:create', input),
    read: (notePath, vaultId) => ipcRenderer.invoke('note:read', notePath, vaultId),
    update: (notePath, vaultId, update) => ipcRenderer.invoke('note:update', notePath, vaultId, update),
    delete: (notePath) => ipcRenderer.invoke('note:delete', notePath),
    list: (vaultPath) => ipcRenderer.invoke('note:list', vaultPath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('note:rename', oldPath, newPath),
    getTitle: (notePath) => ipcRenderer.invoke('note:get-title', notePath),
    getRelativePath: (notePath, vaultPath) => ipcRenderer.invoke('note:get-relative-path', notePath, vaultPath),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
