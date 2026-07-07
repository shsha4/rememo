import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { VaultConfig } from '@memograph/core';
import { vaultService } from './vault.service';

const VAULT_CONFIG_FILE = 'vault.json';

// 실제 임시 디렉터리에 vault를 만들어 id 영속/마이그레이션을 실측하는 통합 테스트.
describe('VaultService id 영속화', () => {
  let parentDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-vault-'));
    // createVault는 대상 경로가 없으면 만들어주므로 하위 경로를 vault로 사용한다.
    vaultPath = path.join(parentDir, 'my-vault');
  });

  afterEach(async () => {
    await fs.rm(parentDir, { recursive: true, force: true });
  });

  async function readConfig(): Promise<VaultConfig> {
    const raw = await fs.readFile(path.join(vaultPath, VAULT_CONFIG_FILE), 'utf-8');
    return JSON.parse(raw) as VaultConfig;
  }

  it('createVault가 vault.json에 id를 저장하고 반환 vault.id와 동일하다', async () => {
    const vault = await vaultService.createVault(vaultPath, '테스트 볼트');
    const config = await readConfig();

    expect(config.id).toBeTruthy();
    expect(vault.id).toBe(config.id);
  });

  it('openVault를 두 번 호출해도 vault.id가 동일하게 유지된다', async () => {
    await vaultService.createVault(vaultPath, '테스트 볼트');

    const first = await vaultService.openVault(vaultPath);
    const second = await vaultService.openVault(vaultPath);

    expect(first.id).toBe(second.id);
  });

  it('레거시 vault.json(id 없음)을 열면 id를 생성해 파일에 영속화한다', async () => {
    await vaultService.createVault(vaultPath, '레거시 볼트');

    // 레거시 상태 재현: 저장된 config에서 id를 제거해 다시 쓴다.
    const config = await readConfig();
    delete (config as Partial<VaultConfig>).id;
    await fs.writeFile(
      path.join(vaultPath, VAULT_CONFIG_FILE),
      JSON.stringify(config, null, 2),
      'utf-8',
    );

    const opened = await vaultService.openVault(vaultPath);
    expect(opened.id).toBeTruthy();

    // 마이그레이션이 파일에 실제로 기록됐는지 확인.
    const persisted = await readConfig();
    expect(persisted.id).toBe(opened.id);

    // 다시 열어도 같은 id가 유지된다(새로 생성되지 않는다).
    const reopened = await vaultService.openVault(vaultPath);
    expect(reopened.id).toBe(opened.id);
  });

  it('updateVaultConfig 호출이 id를 바꾸거나 잃지 않는다', async () => {
    const vault = await vaultService.createVault(vaultPath, '테스트 볼트');
    const originalId = vault.id;

    // 이름 변경 + 악의적으로 id를 바꾸려 시도해도 무시되어야 한다.
    await vaultService.updateVaultConfig(vaultPath, {
      name: '새 이름',
      id: 'malicious-id',
    } as Partial<VaultConfig>);

    const config = await readConfig();
    expect(config.name).toBe('새 이름');
    expect(config.id).toBe(originalId);
  });
});

describe('VaultService — AGENTS.md 자동 생성', () => {
  let parentDir: string;
  let vaultPath: string;

  beforeEach(async () => {
    parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-vault-guide-'));
    vaultPath = path.join(parentDir, 'my-vault');
  });

  afterEach(async () => {
    await fs.rm(parentDir, { recursive: true, force: true });
  });

  async function readGuide(): Promise<string> {
    return fs.readFile(path.join(vaultPath, 'AGENTS.md'), 'utf-8');
  }

  it('openVault가 AGENTS.md를 자동 생성한다', async () => {
    await vaultService.createVault(vaultPath, '볼트');
    await vaultService.openVault(vaultPath);

    const content = await readGuide();
    expect(content).toContain('# rememo vault — LLM 에이전트 맥락 가이드');
  });

  it('ensureAgentGuide는 이미 있으면 덮어쓰지 않는다', async () => {
    await vaultService.createVault(vaultPath, '볼트');
    await fs.writeFile(path.join(vaultPath, 'AGENTS.md'), '사용자 편집본', 'utf-8');

    const created = await vaultService.ensureAgentGuide(vaultPath);

    expect(created).toBe(false);
    expect(await readGuide()).toBe('사용자 편집본');
  });

  it('ensureAgentGuide는 없을 때 생성하고 true를 반환한다', async () => {
    await vaultService.createVault(vaultPath, '볼트');
    // createVault→openVault 경로를 안 거쳤을 때를 위해 직접 호출 검증.
    await fs.rm(path.join(vaultPath, 'AGENTS.md'), { force: true });

    const created = await vaultService.ensureAgentGuide(vaultPath);

    expect(created).toBe(true);
    expect(await readGuide()).toContain('파일이 곧 그래프');
  });
});
