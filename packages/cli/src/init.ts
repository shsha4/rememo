import { promises as fs } from 'fs';
import path from 'path';
import { AGENT_GUIDE } from '@memograph/core';

export interface InitResult {
  // 생성 대상 절대경로(<vault>/AGENTS.md)
  path: string;
  // 실제로 파일을 썼는지. 이미 있고 force가 아니면 false.
  written: boolean;
}

/**
 * vault 루트에 지침(AGENTS.md)을 써넣는다.
 * 이미 존재하고 force가 아니면 덮어쓰지 않고 written=false로 돌려준다(편집 유실 방지).
 */
export async function writeAgentGuide(vaultPath: string, force: boolean): Promise<InitResult> {
  const target = path.join(path.resolve(vaultPath), 'AGENTS.md');

  let exists = false;
  try {
    await fs.stat(target);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !force) {
    return { path: target, written: false };
  }

  await fs.writeFile(target, AGENT_GUIDE, 'utf-8');
  return { path: target, written: true };
}
