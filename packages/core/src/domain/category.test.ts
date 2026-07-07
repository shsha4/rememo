import { describe, it, expect } from 'vitest';
import {
  buildNoteTree,
  getNoteCategoryPath,
  type CategoryTreeItem,
  type TreeItem,
} from './category';

const VAULT = '/vault';

/** 테스트 가독성을 위해 트리를 "이름:타입" 요약으로 평탄화한다. */
function summarize(items: TreeItem[]): string[] {
  return items.map((item) =>
    item.type === 'category'
      ? `${item.path}/ [${summarize(item.children).join(', ')}]`
      : item.title,
  );
}

function findCategory(items: TreeItem[], path: string): CategoryTreeItem | undefined {
  for (const item of items) {
    if (item.type === 'category') {
      if (item.path === path) return item;
      const found = findCategory(item.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

describe('buildNoteTree', () => {
  it('notesDir 하위 폴더를 카테고리로, .md를 노트 잎으로 계층화한다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: [
        '/vault/Notes/카프카/주키퍼.md',
        '/vault/Notes/카프카/분산시스템.md',
        '/vault/Notes/엘라스틱서치/루씬.md',
      ],
    });

    // 카테고리 2개, 각 안에 노트. 한글 정렬상 "엘"(ㅇ)이 "카"(ㅋ)보다 앞선다.
    expect(summarize(tree)).toEqual(['엘라스틱서치/ [루씬]', '카프카/ [분산시스템, 주키퍼]']);
  });

  it('루트(notesDir 직속) 노트는 최상위 잎으로 둔다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: ['/vault/Notes/개요.md', '/vault/Notes/카프카/주키퍼.md'],
    });

    expect(summarize(tree)).toEqual(['카프카/ [주키퍼]', '개요']);
  });

  it('각 레벨에서 카테고리를 노트보다 먼저, 그 안에서 이름순으로 정렬한다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: ['/vault/Notes/zzz.md', '/vault/Notes/aaa.md', '/vault/Notes/베타/x.md'],
    });

    // 카테고리(베타) 먼저, 그 다음 노트 aaa, zzz.
    expect(summarize(tree)).toEqual(['베타/ [x]', 'aaa', 'zzz']);
  });

  it('중첩 카테고리(카테고리 안의 카테고리)를 만든다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: ['/vault/Notes/카프카/내부/세그먼트.md'],
    });

    const inner = findCategory(tree, '카프카/내부');
    expect(inner).toBeDefined();
    expect(inner!.name).toBe('내부');
    expect(summarize(inner!.children)).toEqual(['세그먼트']);
  });

  it('folderPaths로 노트 없는 빈 카테고리도 노출한다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: [],
      folderPaths: ['/vault/Notes/빈카테고리'],
    });

    const empty = findCategory(tree, '빈카테고리');
    expect(empty).toBeDefined();
    expect(empty!.children).toEqual([]);
  });

  it('백슬래시 경로도 정규화해 동일하게 처리한다(Windows)', () => {
    const tree = buildNoteTree({
      vaultPath: 'C:\\vault',
      notesDir: 'Notes',
      notePaths: ['C:\\vault\\Notes\\카프카\\주키퍼.md'],
    });

    expect(summarize(tree)).toEqual(['카프카/ [주키퍼]']);
    // 노트 경로는 정규화(슬래시)되어 저장된다.
    const cat = findCategory(tree, '카프카')!;
    expect(cat.children[0]).toMatchObject({
      type: 'note',
      path: 'C:/vault/Notes/카프카/주키퍼.md',
    });
  });

  it('notesDir 밖의 폴더도 카테고리로 취급한다', () => {
    const tree = buildNoteTree({
      vaultPath: VAULT,
      notesDir: 'Notes',
      notePaths: ['/vault/기타/메모.md'],
    });

    expect(summarize(tree)).toEqual(['기타/ [메모]']);
  });
});

describe('getNoteCategoryPath', () => {
  it('노트의 카테고리 상대 경로를 계산한다', () => {
    expect(getNoteCategoryPath('/vault/Notes/카프카/주키퍼.md', VAULT, 'Notes')).toBe('카프카');
    expect(getNoteCategoryPath('/vault/Notes/카프카/내부/x.md', VAULT, 'Notes')).toBe(
      '카프카/내부',
    );
  });

  it('루트 노트는 빈 문자열을 반환한다', () => {
    expect(getNoteCategoryPath('/vault/Notes/개요.md', VAULT, 'Notes')).toBe('');
  });
});
