import { normalizeNotePath } from '../util/note-path';

/**
 * 카테고리 = vault의 물리적 폴더. rememo는 로컬 우선 마크다운 앱이라 파일시스템이 진실의
 * 원천이므로, 카테고리 계층은 별도 필드가 아니라 노트가 놓인 폴더 경로에서 파생한다.
 * 이 모듈은 순수 함수만 담는다(파일 IO는 desktop의 category.service가 담당).
 */

/** 카테고리 트리의 노트 잎(leaf). */
export interface NoteTreeItem {
  type: 'note';
  /** 정규화된 노트 전체 경로(슬래시). */
  path: string;
  /** 표시 이름(확장자 없는 파일명). */
  title: string;
}

/** 카테고리(폴더) 노드. 하위 카테고리와 노트를 자식으로 갖는다. */
export interface CategoryTreeItem {
  type: 'category';
  /** 마지막 세그먼트 이름(예: "카프카"). */
  name: string;
  /** notesDir를 제외한, 노트 루트 기준 상대 카테고리 경로(예: "카프카/주키퍼"). */
  path: string;
  children: TreeItem[];
}

export type TreeItem = CategoryTreeItem | NoteTreeItem;

export interface BuildNoteTreeInput {
  /** 노트 전체 경로 목록. */
  notePaths: string[];
  /** 빈 카테고리도 트리에 노출하기 위한 폴더(디렉터리) 전체 경로 목록. */
  folderPaths?: string[];
  /** vault 루트 경로. */
  vaultPath: string;
  /** 기본 노트 폴더명(예: "Notes"). 이 선행 세그먼트는 카테고리에서 제외한다. */
  notesDir: string;
}

/**
 * 전체 경로를 vault 루트 기준 상대 세그먼트 배열로 변환하고, 선행 notesDir 세그먼트를 제거한다.
 * 예) vault=/v, notesDir=Notes, path=/v/Notes/카프카/주키퍼.md → ['카프카','주키퍼.md']
 */
function toRelativeSegments(fullPath: string, vaultPath: string, notesDir: string): string[] {
  const norm = normalizeNotePath(fullPath);
  const base = normalizeNotePath(vaultPath).replace(/\/+$/, '');
  let rel = norm === base ? '' : norm.startsWith(base + '/') ? norm.slice(base.length + 1) : norm;

  const dir = notesDir.replace(/^\/+|\/+$/g, '');
  if (dir && (rel === dir || rel.startsWith(dir + '/'))) {
    rel = rel.slice(dir.length).replace(/^\/+/, '');
  }

  return rel.split('/').filter(Boolean);
}

/**
 * 노트의 카테고리 상대 경로를 계산한다(예: "카프카/주키퍼", 루트 노트는 '').
 * 그래프의 카테고리 박스 그룹핑 등 트리 밖에서도 재사용한다.
 */
export function getNoteCategoryPath(notePath: string, vaultPath: string, notesDir: string): string {
  const segments = toRelativeSegments(notePath, vaultPath, notesDir);
  // 마지막 세그먼트는 파일명이므로 제외한다.
  return segments.slice(0, -1).join('/');
}

/**
 * 노트/폴더 경로 목록으로 카테고리 트리를 만든다(순수 함수).
 * 정렬: 각 레벨에서 카테고리 먼저(이름 오름차순), 그 다음 노트(제목 오름차순).
 */
export function buildNoteTree(input: BuildNoteTreeInput): TreeItem[] {
  const { notePaths, folderPaths = [], vaultPath, notesDir } = input;
  const root: CategoryTreeItem = { type: 'category', name: '', path: '', children: [] };

  // 세그먼트 경로를 따라 카테고리 노드를 생성/조회한다.
  const ensureCategory = (segments: string[]): CategoryTreeItem => {
    let node = root;
    let acc = '';
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.children.find(
        (c): c is CategoryTreeItem => c.type === 'category' && c.name === seg,
      );
      if (!child) {
        child = { type: 'category', name: seg, path: acc, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    return node;
  };

  // 빈 카테고리도 노출하기 위해 폴더 경로로 카테고리 노드를 먼저 만든다.
  for (const folderPath of folderPaths) {
    const segments = toRelativeSegments(folderPath, vaultPath, notesDir);
    if (segments.length > 0) {
      ensureCategory(segments);
    }
  }

  // 노트를 해당 카테고리에 배치한다.
  for (const notePath of notePaths) {
    const segments = toRelativeSegments(notePath, vaultPath, notesDir);
    if (segments.length === 0) {
      continue; // vault 루트 자신 등 비정상 케이스 방어
    }
    const fileName = segments[segments.length - 1];
    const categorySegments = segments.slice(0, -1);
    const title = fileName.replace(/\.md$/i, '');
    const parent = categorySegments.length > 0 ? ensureCategory(categorySegments) : root;
    parent.children.push({ type: 'note', path: normalizeNotePath(notePath), title });
  }

  sortTree(root);
  return root.children;
}

function sortTree(node: CategoryTreeItem): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'category' ? -1 : 1; // 카테고리 먼저
    }
    const an = a.type === 'category' ? a.name : a.title;
    const bn = b.type === 'category' ? b.name : b.title;
    return an.localeCompare(bn);
  });
  for (const child of node.children) {
    if (child.type === 'category') {
      sortTree(child);
    }
  }
}

export class CategoryAlreadyExistsError extends Error {
  constructor(path: string) {
    super(`Category already exists at path: ${path}`);
    this.name = 'CategoryAlreadyExistsError';
  }
}

export class CategoryNotFoundError extends Error {
  constructor(path: string) {
    super(`Category not found: ${path}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class CategoryNotEmptyError extends Error {
  constructor(path: string) {
    super(`Category is not empty: ${path}`);
    this.name = 'CategoryNotEmptyError';
  }
}
