import { describe, it, expect } from 'vitest';
import path from 'path';
import type { VaultNote } from './vault';
import { buildGraph, backlinksFor, buildContext, searchNotes, findNoteByTitle } from './graph';

// 테스트용 가짜 vault 루트(절대경로). 실제 파일 IO 없이 VaultNote를 손으로 만든다.
const VAULT = path.resolve('graph-test-vault');

// rel은 '/' 구분자로 받고 OS 네이티브 경로로 정규화한다.
function note(rel: string, content: string): VaultNote {
  const relNative = rel.split('/').join(path.sep);
  const base = rel.split('/').pop()!;
  return {
    path: path.join(VAULT, relNative),
    relativePath: relNative,
    title: base.slice(0, -'.md'.length),
    content,
  };
}

describe('buildGraph — 명시적 위키링크', () => {
  it('제목 완전일치로 링크를 대상 노트에 해석한다', () => {
    const notes = [note('박민준.md', '나는 [[카프카]]를 공부한다.'), note('카프카.md', '# 카프카')];
    const graph = buildGraph(notes, VAULT);

    const edge = graph.edges.find((e) => e.linkType === 'wiki_link');
    expect(edge).toBeDefined();
    expect(edge!.source).toBe('박민준.md');
    expect(edge!.target).toBe('카프카.md');
    expect(edge!.linkText).toBe('카프카');
  });

  it('대상 노트가 없으면 target이 null(깨진 링크)이다', () => {
    const notes = [note('박민준.md', '[[존재하지않는노트]] 참조')];
    const graph = buildGraph(notes, VAULT);

    const edge = graph.edges.find((e) => e.linkType === 'wiki_link');
    expect(edge).toBeDefined();
    expect(edge!.target).toBeNull();
    expect(edge!.linkText).toBe('존재하지않는노트');
  });

  it('같은 대상으로의 별칭·헤딩 링크는 하나의 엣지로 합쳐진다', () => {
    const notes = [
      note('A.md', '[[카프카|메시지 큐]] 그리고 [[카프카#설치]]'),
      note('카프카.md', '#'),
    ];
    const graph = buildGraph(notes, VAULT);
    const edges = graph.edges.filter((e) => e.source === 'A.md');

    expect(edges).toHaveLength(1);
    expect(edges[0].target).toBe('카프카.md');
    expect(edges[0].linkType).toBe('wiki_link');
  });

  it('단일 별칭/헤딩 링크는 alias·heading을 엣지에 보존한다', () => {
    const aliased = buildGraph(
      [note('A.md', '[[카프카|메시지 큐]]'), note('카프카.md', '#')],
      VAULT,
    ).edges.find((e) => e.source === 'A.md');
    expect(aliased?.alias).toBe('메시지 큐');
    expect(aliased?.target).toBe('카프카.md');

    const headed = buildGraph(
      [note('B.md', '[[카프카#설치]]'), note('카프카.md', '#')],
      VAULT,
    ).edges.find((e) => e.source === 'B.md');
    expect(headed?.heading).toBe('설치');
    expect(headed?.target).toBe('카프카.md');
  });
});

describe('backlinksFor — 백링크', () => {
  it('대상을 가리키는 노트를 역참조로 찾는다', () => {
    const notes = [
      note('박민준.md', '[[카프카]] 좋아함'),
      note('은혁진.md', '나도 [[카프카]] 씀'),
      note('카프카.md', '# 카프카'),
    ];
    const graph = buildGraph(notes, VAULT);

    const backlinks = backlinksFor('카프카.md', graph);
    const sources = backlinks.map((e) => e.source).sort();
    expect(sources).toEqual(['박민준.md', '은혁진.md']);
  });
});

describe('엔티티 멘션 — 자동 감지 관계', () => {
  it('본문에 제목이 조사와 함께 등장하면 entity_mention으로 잡는다', () => {
    const notes = [
      note('회고.md', '오늘 박민준과 카프카를 이야기했다.'),
      note('박민준.md', '# 박민준'),
      note('카프카.md', '# 카프카'),
    ];
    const graph = buildGraph(notes, VAULT);

    const mentions = graph.edges.filter(
      (e) => e.source === '회고.md' && e.linkType === 'entity_mention',
    );
    const targets = mentions.map((m) => m.target).sort();
    expect(targets).toEqual(['박민준.md', '카프카.md']);
  });

  it('명시적 [[링크]] 안의 텍스트는 멘션으로 중복 집계하지 않는다', () => {
    const notes = [note('회고.md', '[[박민준]]을 만났다.'), note('박민준.md', '# 박민준')];
    const graph = buildGraph(notes, VAULT);

    const edges = graph.edges.filter((e) => e.source === '회고.md');
    // 위키링크 1개만, 엔티티 멘션 중복 없음
    expect(edges).toHaveLength(1);
    expect(edges[0].linkType).toBe('wiki_link');
  });
});

describe('그래프 엣지 병합 — (source, target) dedup', () => {
  it('같은 대상에 대한 위키링크+엔티티멘션을 wiki_link 하나로 합친다', () => {
    const notes = [
      note('회고.md', '[[박민준]]을 만났고 박민준과 밥먹음'),
      note('박민준.md', '# 박민준'),
    ];
    const graph = buildGraph(notes, VAULT);
    const edges = graph.edges.filter((e) => e.source === '회고.md' && e.target === '박민준.md');
    expect(edges).toHaveLength(1);
    expect(edges[0].linkType).toBe('wiki_link');
  });

  it('같은 대상으로의 다중 위키링크도 하나로 합친다', () => {
    const notes = [note('A.md', '[[B]] 그리고 또 [[B]]'), note('B.md', '# B')];
    const graph = buildGraph(notes, VAULT);
    expect(graph.edges.filter((e) => e.source === 'A.md')).toHaveLength(1);
  });

  it('서로 다른 깨진 링크는 각각 보존한다', () => {
    const notes = [note('A.md', '[[없음1]] 그리고 [[없음2]]')];
    const graph = buildGraph(notes, VAULT);
    const broken = graph.edges.filter((e) => e.target === null);
    expect(broken.map((e) => e.linkText).sort()).toEqual(['없음1', '없음2']);
  });

  it('같은 깨진 링크의 중복은 하나로 합친다', () => {
    const notes = [note('A.md', '[[없음]] 또 [[없음]]')];
    const graph = buildGraph(notes, VAULT);
    expect(graph.edges.filter((e) => e.target === null)).toHaveLength(1);
  });
});

describe('buildContext — 노트 중심 맥락', () => {
  const notes = [
    note('카프카.md', '# 카프카\n#메시지큐 #인프라\n[[주키퍼]] 필요'),
    note('박민준.md', '[[카프카]] 공부 중'),
    note('주키퍼.md', '# 주키퍼'),
    note('무관.md', '# 무관한 노트'),
  ];

  it('아웃링크·백링크·태그·이웃을 모은다 (hops=1)', () => {
    const ctx = buildContext(notes[0], notes, VAULT, 1);

    expect(ctx.title).toBe('카프카');
    expect(ctx.tags.sort()).toEqual(['메시지큐', '인프라']);
    expect(ctx.outgoing.map((e) => e.target)).toContain('주키퍼.md');
    expect(ctx.backlinks.map((e) => e.source)).toContain('박민준.md');
    expect(ctx.neighbors.sort()).toEqual(['박민준.md', '주키퍼.md']);
    expect(ctx.neighbors).not.toContain('무관.md');
  });

  it('hops=0이면 이웃은 비지만 아웃링크·백링크는 그대로 제공한다', () => {
    const ctx = buildContext(notes[0], notes, VAULT, 0);
    expect(ctx.neighbors).toEqual([]);
    expect(ctx.outgoing.length).toBeGreaterThan(0);
    expect(ctx.backlinks.length).toBeGreaterThan(0);
  });

  it('hops=2면 이웃의 이웃까지 확장한다', () => {
    const chain = [note('A.md', '[[B]]'), note('B.md', '[[C]]'), note('C.md', '# C')];
    const ctx1 = buildContext(chain[0], chain, VAULT, 1);
    expect(ctx1.neighbors.sort()).toEqual(['B.md']);

    const ctx2 = buildContext(chain[0], chain, VAULT, 2);
    expect(ctx2.neighbors.sort()).toEqual(['B.md', 'C.md']);
  });
});

describe('searchNotes — 검색', () => {
  const notes = [note('카프카.md', '메시지 큐 시스템'), note('회고.md', '오늘 카프카를 배웠다')];

  it('제목/본문을 대소문자 무시로 검색하고 제목 매칭을 먼저 보여준다', () => {
    const hits = searchNotes('카프카', notes);
    expect(hits).toHaveLength(2);
    // 제목 매칭이 먼저
    expect(hits[0].title).toBe('카프카');
    expect(hits[0].matchedTitle).toBe(true);
    expect(hits[1].title).toBe('회고');
    expect(hits[1].matchedContent).toBe(true);
  });
});

describe('findNoteByTitle', () => {
  it('제목 완전일치 노트를 찾고, 없으면 undefined', () => {
    const notes = [note('카프카.md', '#')];
    expect(findNoteByTitle('카프카', notes)?.relativePath).toBe('카프카.md');
    expect(findNoteByTitle('없음', notes)).toBeUndefined();
  });
});
