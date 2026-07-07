import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { noteService, isAgentGuidePath, AGENT_GUIDE_FILE } from './note.service';

// 실제 임시 볼트에 파일을 만들어 listNotes가 무엇을 노출하는지 실측한다.
describe('NoteService.listNotes — AGENTS.md 제외', () => {
  let vaultPath: string;

  beforeEach(async () => {
    vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-notes-'));
  });

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('볼트 루트의 AGENTS.md는 노트 목록에서 제외된다', async () => {
    await fs.writeFile(path.join(vaultPath, AGENT_GUIDE_FILE), '지침', 'utf-8');
    await fs.writeFile(path.join(vaultPath, '박민준.md'), '# 박민준', 'utf-8');

    const notes = await noteService.listNotes(vaultPath);

    expect(notes.some((p) => p.endsWith('박민준.md'))).toBe(true);
    expect(notes.some((p) => p.endsWith('AGENTS.md'))).toBe(false);
  });

  it('하위 폴더의 AGENTS.md(사용자 노트)는 목록에 남는다', async () => {
    const sub = path.join(vaultPath, 'Notes');
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(sub, AGENT_GUIDE_FILE), '# 사용자 노트', 'utf-8');

    const notes = await noteService.listNotes(vaultPath);

    expect(notes.some((p) => p.endsWith('AGENTS.md'))).toBe(true);
  });
});

describe('isAgentGuidePath', () => {
  const vaultPath = path.join(os.tmpdir(), 'some-vault');

  it('볼트 루트의 AGENTS.md만 true', () => {
    expect(isAgentGuidePath(path.join(vaultPath, 'AGENTS.md'), vaultPath)).toBe(true);
  });

  it('하위 폴더의 AGENTS.md는 false', () => {
    expect(isAgentGuidePath(path.join(vaultPath, 'Notes', 'AGENTS.md'), vaultPath)).toBe(false);
  });

  it('다른 노트는 false', () => {
    expect(isAgentGuidePath(path.join(vaultPath, '박민준.md'), vaultPath)).toBe(false);
  });
});
