import type { Vault, VaultConfig } from '../domain/vault';
import { VaultNotFoundError, VaultAlreadyExistsError } from '../domain/vault';
import { fileService } from './file.service';
import path from 'path';
import crypto from 'crypto';

const VAULT_CONFIG_FILE = 'vault.json';
const MEMOGRAPH_DIR = '.memograph';

export class VaultService {
  async createVault(vaultPath: string, name: string): Promise<Vault> {
    console.log('[VaultService] Creating vault at:', vaultPath, 'with name:', name);

    const exists = await fileService.directoryExists(vaultPath);
    if (!exists) {
      console.log('[VaultService] Directory does not exist, creating:', vaultPath);
      await fileService.createDirectory(vaultPath);
    }

    const vaultConfigPath = path.join(vaultPath, VAULT_CONFIG_FILE);
    console.log('[VaultService] Checking for existing vault.json at:', vaultConfigPath);
    const configExists = await fileService.fileExists(vaultConfigPath);

    if (configExists) {
      console.error('[VaultService] Vault already exists at:', vaultPath);
      throw new VaultAlreadyExistsError(vaultPath);
    }

    // Create vault config
    const config: VaultConfig = {
      version: '1.0.0',
      name,
      defaultNoteLocation: 'Notes',
      defaultAssetLocation: 'Assets',
    };

    // Create vault
    const vault: Vault = {
      id: crypto.randomUUID(),
      name,
      path: vaultPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      config,
    };

    console.log('[VaultService] Creating vault structure...');
    // Create necessary directories
    const notesDir = path.join(vaultPath, config.defaultNoteLocation!);
    const assetsDir = path.join(vaultPath, config.defaultAssetLocation!);
    const memographDir = path.join(vaultPath, MEMOGRAPH_DIR);

    console.log('[VaultService] Creating directories:', { notesDir, assetsDir, memographDir });
    await Promise.all([
      fileService.createDirectory(notesDir),
      fileService.createDirectory(assetsDir),
      fileService.createDirectory(memographDir),
    ]);

    // Write vault config
    console.log('[VaultService] Writing vault.json to:', vaultConfigPath);
    await fileService.writeFile(vaultConfigPath, JSON.stringify(config, null, 2));

    console.log('[VaultService] Vault created successfully:', vault);
    return vault;
  }

  async openVault(vaultPath: string): Promise<Vault> {
    const exists = await fileService.directoryExists(vaultPath);
    if (!exists) {
      throw new VaultNotFoundError(vaultPath);
    }

    const vaultConfigPath = path.join(vaultPath, VAULT_CONFIG_FILE);
    const configExists = await fileService.fileExists(vaultConfigPath);

    if (!configExists) {
      throw new VaultNotFoundError(vaultPath);
    }

    const configContent = await fileService.readFile(vaultConfigPath);
    const config: VaultConfig = JSON.parse(configContent);

    const vault: Vault = {
      id: crypto.randomUUID(), // In a real app, this would be persisted
      name: config.name,
      path: vaultPath,
      createdAt: new Date(), // Would be loaded from metadata
      updatedAt: new Date(),
      config,
    };

    return vault;
  }

  async updateVaultConfig(vaultPath: string, config: Partial<VaultConfig>): Promise<void> {
    const vault = await this.openVault(vaultPath);
    const updatedConfig = { ...vault.config, ...config };
    const vaultConfigPath = path.join(vaultPath, VAULT_CONFIG_FILE);
    await fileService.writeFile(vaultConfigPath, JSON.stringify(updatedConfig, null, 2));
  }

  async isValidVault(vaultPath: string): Promise<boolean> {
    try {
      await this.openVault(vaultPath);
      return true;
    } catch {
      return false;
    }
  }

  getVaultConfigPath(vaultPath: string): string {
    return path.join(vaultPath, VAULT_CONFIG_FILE);
  }

  getMemographDirPath(vaultPath: string): string {
    return path.join(vaultPath, MEMOGRAPH_DIR);
  }
}

export const vaultService = new VaultService();
