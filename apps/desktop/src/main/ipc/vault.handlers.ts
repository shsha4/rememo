import { ipcMain } from 'electron';
import { vaultService } from '../services/vault.service';
import { fileService } from '../services/file.service';
import type { VaultConfig } from '@memograph/core';

export function setupVaultHandlers() {
  ipcMain.handle('vault:select-folder', async () => {
    return fileService.selectFolder();
  });

  ipcMain.handle('vault:create', async (_event, vaultPath: string, name: string) => {
    return vaultService.createVault(vaultPath, name);
  });

  ipcMain.handle('vault:open', async (_event, vaultPath: string) => {
    return vaultService.openVault(vaultPath);
  });

  ipcMain.handle('vault:is-valid', async (_event, vaultPath: string) => {
    return vaultService.isValidVault(vaultPath);
  });

  ipcMain.handle(
    'vault:update-config',
    async (_event, vaultPath: string, config: Partial<VaultConfig>) => {
      return vaultService.updateVaultConfig(vaultPath, config);
    },
  );
}
