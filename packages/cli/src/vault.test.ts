import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadVault } from './vault';

let vaultDir: string;

beforeAll(async () => {
  vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-vault-'));

  await fs.writeFile(path.join(vaultDir, '박민준.md'), '# 박민준\n[[카프카]]', 'utf-8');

  // 하위 디렉터리 노트
  const sub = path.join(vaultDir, 'people');
  await fs.mkdir(sub);
  await fs.writeFile(path.join(sub, '은혁진.md'), '# 은혁진', 'utf-8');

  // 제외 대상: .memograph 안의 파일은 읽지 않는다
  const memo = path.join(vaultDir, '.memograph');
  await fs.mkdir(memo);
  await fs.writeFile(path.join(memo, 'index.md'), '무시되어야 함', 'utf-8');

  // 제외 대상: 볼트 루트의 지침 파일(AGENTS.md)은 노트가 아니므로 그래프/검색에서 빠진다
  await fs.writeFile(path.join(vaultDir, 'AGENTS.md'), '# 에이전트 지침', 'utf-8');

  // .md가 아닌 파일도 무시
  await fs.writeFile(path.join(vaultDir, 'readme.txt'), 'not markdown', 'utf-8');
});

afterAll(async () => {
  await fs.rm(vaultDir, { recursive: true, force: true });
});

describe('loadVault', () => {
  it('.md 파일만 재귀적으로 읽고 .memograph·비마크다운은 제외한다', async () => {
    const notes = await loadVault(vaultDir);
    const titles = notes.map((n) => n.title).sort();
    expect(titles).toEqual(['박민준', '은혁진']);
  });

  it('볼트 루트의 AGENTS.md는 제외하되 하위 폴더의 동명 노트는 포함한다', async () => {
    const scoped = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-vault-guide-'));
    try {
      await fs.writeFile(path.join(scoped, 'AGENTS.md'), '# 지침', 'utf-8');
      const sub = path.join(scoped, 'notes');
      await fs.mkdir(sub);
      await fs.writeFile(path.join(sub, 'AGENTS.md'), '# 사용자 노트', 'utf-8');

      const notes = await loadVault(scoped);
      const rels = notes.map((n) => n.relativePath);

      expect(rels).toEqual([path.join('notes', 'AGENTS.md')]);
    } finally {
      await fs.rm(scoped, { recursive: true, force: true });
    }
  });

  it('title은 확장자를 뺀 파일명, relativePath는 vault 루트 기준이다', async () => {
    const notes = await loadVault(vaultDir);
    const eunhyeok = notes.find((n) => n.title === '은혁진');
    expect(eunhyeok).toBeDefined();
    expect(eunhyeok!.relativePath).toBe(path.join('people', '은혁진.md'));
    expect(eunhyeok!.content).toContain('# 은혁진');
  });
});
