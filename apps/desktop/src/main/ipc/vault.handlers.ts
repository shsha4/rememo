import { ipcMain } from 'electron';
import { ipcHandler } from './ipc-result';
import { vaultService } from '../services/vault.service';
import { fileService } from '../services/file.service';
import type {
  VaultCreateRequest,
  VaultOpenRequest,
  VaultIsValidRequest,
  VaultUpdateConfigRequest,
} from '../../shared/ipc';

export function setupVaultHandlers() {
  ipcMain.handle(
    'vault:select-folder',
    ipcHandler(async () => {
      return fileService.selectFolder();
    }),
  );

  ipcMain.handle(
    'vault:create',
    ipcHandler(async (_event, req: VaultCreateRequest) => {
      const { vaultPath, name } = req;
      return vaultService.createVault(vaultPath, name);
    }),
  );

  ipcMain.handle(
    'vault:open',
    ipcHandler(async (_event, req: VaultOpenRequest) => {
      const { vaultPath } = req;
      return vaultService.openVault(vaultPath);
    }),
  );

  ipcMain.handle(
    'vault:is-valid',
    ipcHandler(async (_event, req: VaultIsValidRequest) => {
      const { vaultPath } = req;
      return vaultService.isValidVault(vaultPath);
    }),
  );

  ipcMain.handle(
    'vault:update-config',
    ipcHandler(async (_event, req: VaultUpdateConfigRequest) => {
      const { vaultPath, config } = req;
      return vaultService.updateVaultConfig(vaultPath, config);
    }),
  );
}
