import { promises as fs } from 'fs';
import path from 'path';
import { AGENT_GUIDE_FILE } from './init';

// vault에서 읽어들인 한 노트. SQLite가 아니라 파일에서 즉석으로 만든 것이라 항상 최신이다.
export interface VaultNote {
  // 절대경로
  path: string;
  // vault 루트 기준 상대경로 (표시·식별용)
  relativePath: string;
  // 확장자를 제외한 파일명 = 노트 제목 (링크 대상 매칭 기준). desktop의 note.service와 동일 규칙.
  title: string;
  // 파일 원문
  content: string;
}

// 색인 대상에서 제외하는 디렉터리 (desktop indexer/note.service와 동일 정책).
const IGNORED_DIRS = new Set(['.memograph', 'node_modules', '.git']);

/**
 * vault 하위의 모든 `.md` 파일을 재귀적으로 읽어 VaultNote 목록으로 돌려준다.
 * SQLite 인덱스를 거치지 않고 파일시스템을 직접 읽으므로 앱 구동 여부와 무관하게 최신이다.
 */
export async function loadVault(vaultPath: string): Promise<VaultNote[]> {
  const absVault = path.resolve(vaultPath);
  const notes: VaultNote[] = [];
  await collect(absVault, absVault, notes);
  return notes;
}

async function collect(dirPath: string, vaultRoot: string, out: VaultNote[]): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      await collect(path.join(dirPath, entry.name), vaultRoot, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const fullPath = path.join(dirPath, entry.name);
      // 볼트 루트의 지침 파일(AGENTS.md)은 노트가 아니므로 그래프/검색에서 제외한다.
      if (fullPath === path.join(vaultRoot, AGENT_GUIDE_FILE)) {
        continue;
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      out.push({
        path: fullPath,
        relativePath: path.relative(vaultRoot, fullPath),
        title: entry.name.slice(0, -'.md'.length),
        content,
      });
    }
  }
}
