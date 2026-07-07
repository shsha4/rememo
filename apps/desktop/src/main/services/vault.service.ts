import type { Vault, VaultConfig } from '@memograph/core';
import { VaultNotFoundError, VaultAlreadyExistsError, AGENT_GUIDE } from '@memograph/core';
import { fileService } from './file.service';
import path from 'path';
import crypto from 'crypto';

const VAULT_CONFIG_FILE = 'vault.json';
const MEMOGRAPH_DIR = '.memograph';
// LLM 에이전트 지침 파일. 볼트 오픈 시 없으면 자동 생성한다(있으면 절대 덮어쓰지 않음).
const AGENT_GUIDE_FILE = 'AGENTS.md';

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

    // Create vault config (id는 vault.json에 영속되어 이후 open 시 안정적으로 유지된다)
    const config: VaultConfig = {
      id: crypto.randomUUID(),
      version: '1.0.0',
      name,
      defaultNoteLocation: 'Notes',
      defaultAssetLocation: 'Assets',
    };

    // Create vault
    const vault: Vault = {
      id: config.id,
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

    // 신규 볼트에도 에이전트 지침을 즉시 심는다(생성 경로는 openVault를 거치지 않으므로).
    await this.ensureAgentGuide(vaultPath);

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

    // 마이그레이션: 레거시 vault.json에 id가 없으면 한 번 생성해 파일에 영속화한다.
    // 이렇게 하면 다음 open부터는 항상 같은 id가 유지된다.
    if (!config.id) {
      config.id = crypto.randomUUID();
      await fileService.writeFile(vaultConfigPath, JSON.stringify(config, null, 2));
    }

    const vault: Vault = {
      id: config.id,
      name: config.name,
      path: vaultPath,
      createdAt: new Date(), // Would be loaded from metadata
      updatedAt: new Date(),
      config,
    };

    // 볼트가 활성화되는 단일 관문에서 에이전트 지침(AGENTS.md)을 보장한다.
    // 실패해도 볼트 오픈 자체는 막지 않는다(부수효과).
    await this.ensureAgentGuide(vaultPath);

    return vault;
  }

  /**
   * 볼트 루트에 에이전트 지침(AGENTS.md)이 없으면 생성한다.
   * 이미 있으면 사용자가 편집했을 수 있으므로 절대 덮어쓰지 않는다.
   * 반환값: 실제로 새로 생성했으면 true.
   */
  async ensureAgentGuide(vaultPath: string): Promise<boolean> {
    const guidePath = path.join(vaultPath, AGENT_GUIDE_FILE);
    try {
      if (await fileService.fileExists(guidePath)) {
        return false;
      }
      await fileService.writeFile(guidePath, AGENT_GUIDE);
      console.log('[VaultService] AGENTS.md 생성:', guidePath);
      return true;
    } catch (error) {
      console.error('[VaultService] AGENTS.md 생성 실패:', error);
      return false;
    }
  }

  async updateVaultConfig(vaultPath: string, config: Partial<VaultConfig>): Promise<void> {
    const vault = await this.openVault(vaultPath);
    // id는 영속 고유값이므로 외부 config로 덮어쓰지 못하게 항상 기존 값을 유지한다.
    const updatedConfig: VaultConfig = { ...vault.config, ...config, id: vault.config.id };
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
