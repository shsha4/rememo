import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { writeAgentGuide } from './init';

let vaultDir: string;

beforeEach(async () => {
  vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-init-'));
});

afterEach(async () => {
  await fs.rm(vaultDir, { recursive: true, force: true });
});

describe('writeAgentGuide', () => {
  it('vault 루트에 AGENTS.md를 생성한다', async () => {
    const result = await writeAgentGuide(vaultDir, false);

    expect(result.written).toBe(true);
    expect(result.path).toBe(path.join(vaultDir, 'AGENTS.md'));

    const content = await fs.readFile(result.path, 'utf-8');
    expect(content).toContain('# rememo vault — LLM 에이전트 맥락 가이드');
    expect(content).toContain('진실의 원천은');
  });

  it('이미 있으면 force 없이는 덮어쓰지 않는다', async () => {
    const target = path.join(vaultDir, 'AGENTS.md');
    await fs.writeFile(target, '기존 내용', 'utf-8');

    const result = await writeAgentGuide(vaultDir, false);

    expect(result.written).toBe(false);
    expect(await fs.readFile(target, 'utf-8')).toBe('기존 내용');
  });

  it('force면 기존 파일을 덮어쓴다', async () => {
    const target = path.join(vaultDir, 'AGENTS.md');
    await fs.writeFile(target, '기존 내용', 'utf-8');

    const result = await writeAgentGuide(vaultDir, true);

    expect(result.written).toBe(true);
    expect(await fs.readFile(target, 'utf-8')).toContain('LLM 에이전트 맥락 가이드');
  });
});
