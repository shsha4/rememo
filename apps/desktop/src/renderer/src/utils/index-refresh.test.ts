import { describe, it, expect } from 'vitest';
import { planIndexRefresh, normalizePath, type RefreshContext } from './index-refresh';
import type { IndexChangedPayload } from '../../../shared/ipc';

const VAULT = 'C:\\Users\\me\\vault';
const NOTE = 'C:\\Users\\me\\vault\\Notes\\a.md';

function ctx(overrides: Partial<RefreshContext> = {}): RefreshContext {
  return {
    currentVaultPath: VAULT,
    currentNotePath: NOTE,
    isDirty: false,
    ...overrides,
  };
}

function ev(
  type: IndexChangedPayload['type'],
  path: string,
  vaultPath = VAULT,
): IndexChangedPayload {
  return { type, path, vaultPath };
}

describe('normalizePath', () => {
  it('대소문자와 역슬래시 차이를 흡수한다', () => {
    expect(normalizePath('C:\\A\\B.md')).toBe('c:/a/b.md');
    expect(normalizePath('c:/a/b.md')).toBe(normalizePath('C:\\A\\B.md'));
  });
});

describe('planIndexRefresh', () => {
  it('현재 vault가 없으면 아무것도 하지 않는다', () => {
    const plan = planIndexRefresh(ev('add', NOTE), ctx({ currentVaultPath: null }));
    expect(plan).toEqual({ reloadList: false, openNote: 'keep' });
  });

  it('다른 vault의 변경은 무시한다', () => {
    const plan = planIndexRefresh(ev('change', 'D:\\other\\x.md', 'D:\\other'), ctx());
    expect(plan).toEqual({ reloadList: false, openNote: 'keep' });
  });

  it('새 노트 추가는 목록을 갱신하고 열린 노트는 유지한다', () => {
    const plan = planIndexRefresh(ev('add', 'C:\\Users\\me\\vault\\Notes\\b.md'), ctx());
    expect(plan).toEqual({ reloadList: true, openNote: 'keep' });
  });

  it('열린 노트가 아닌 노트의 수정은 목록만 갱신한다', () => {
    const plan = planIndexRefresh(ev('change', 'C:\\Users\\me\\vault\\Notes\\b.md'), ctx());
    expect(plan).toEqual({ reloadList: true, openNote: 'keep' });
  });

  it('열린 노트의 외부 수정 + 미저장 없음 → 재읽기', () => {
    const plan = planIndexRefresh(ev('change', NOTE), ctx({ isDirty: false }));
    expect(plan).toEqual({ reloadList: true, openNote: 'reread' });
  });

  it('열린 노트의 외부 수정 + 미저장 있음 → 배너로 보류(flag-external)', () => {
    const plan = planIndexRefresh(ev('change', NOTE), ctx({ isDirty: true }));
    expect(plan).toEqual({ reloadList: true, openNote: 'flag-external' });
  });

  it('열린 노트가 외부에서 삭제되면 에디터를 비운다(clear)', () => {
    const plan = planIndexRefresh(ev('unlink', NOTE), ctx({ isDirty: true }));
    expect(plan).toEqual({ reloadList: true, openNote: 'clear' });
  });

  it('경로 표기(대소문자·구분자)가 달라도 열린 노트로 매칭한다', () => {
    const plan = planIndexRefresh(
      ev('change', 'c:/users/me/vault/notes/a.md'),
      ctx({ isDirty: false }),
    );
    expect(plan.openNote).toBe('reread');
  });
});
