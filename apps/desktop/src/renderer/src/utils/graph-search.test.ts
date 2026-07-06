import { describe, it, expect } from 'vitest';
import { computeGraphSearch } from './graph-search';

// 테스트용 그래프:
//   회의록 → 프로젝트A → 김철수
//            프로젝트A → 이영희
//   독립노트 (엣지 없음)
const nodes = [
  { id: 'n1', label: '회의록' },
  { id: 'n2', label: '프로젝트A' },
  { id: 'n3', label: '김철수' },
  { id: 'n4', label: '이영희' },
  { id: 'n5', label: '독립노트' },
];

const edges = [
  { source: 'n1', target: 'n2' },
  { source: 'n2', target: 'n3' },
  { source: 'n2', target: 'n4' },
];

describe('computeGraphSearch', () => {
  it('빈 검색어면 전체 노드를 visible로, matched는 비운다', () => {
    const result = computeGraphSearch(nodes, edges, '', 1);
    expect(result.matchedIds.size).toBe(0);
    expect(result.visibleIds).toEqual(new Set(['n1', 'n2', 'n3', 'n4', 'n5']));
  });

  it('공백만 있는 검색어도 빈 검색어로 취급한다', () => {
    const result = computeGraphSearch(nodes, edges, '   ', 1);
    expect(result.matchedIds.size).toBe(0);
    expect(result.visibleIds.size).toBe(nodes.length);
  });

  it('한글 부분일치로 매칭하고, 1-hop 이웃을 함께 노출한다', () => {
    // "프로젝트" → n2 매칭, 이웃 n1/n3/n4까지 visible
    const result = computeGraphSearch(nodes, edges, '프로젝트', 1);
    expect(result.matchedIds).toEqual(new Set(['n2']));
    expect(result.visibleIds).toEqual(new Set(['n1', 'n2', 'n3', 'n4']));
    expect(result.visibleIds.has('n5')).toBe(false);
  });

  it('이웃 확장은 무방향이다(들어오는 링크도 이웃으로 취급)', () => {
    // n3(김철수)는 n2에서 들어오는 링크만 있다. 매칭 시 n2가 이웃으로 포함돼야 한다.
    const result = computeGraphSearch(nodes, edges, '김철수', 1);
    expect(result.matchedIds).toEqual(new Set(['n3']));
    expect(result.visibleIds).toEqual(new Set(['n3', 'n2']));
  });

  it('hops=0이면 매칭 노드만 visible로 노출한다', () => {
    const result = computeGraphSearch(nodes, edges, '프로젝트', 0);
    expect(result.matchedIds).toEqual(new Set(['n2']));
    expect(result.visibleIds).toEqual(new Set(['n2']));
  });

  it('hops=2면 두 단계 이웃까지 확장한다', () => {
    // n1(회의록) 매칭 → 1-hop n2 → 2-hop n3,n4
    const result = computeGraphSearch(nodes, edges, '회의록', 2);
    expect(result.matchedIds).toEqual(new Set(['n1']));
    expect(result.visibleIds).toEqual(new Set(['n1', 'n2', 'n3', 'n4']));
  });

  it('대소문자를 무시하고 매칭한다', () => {
    const asciiNodes = [
      { id: 'a', label: 'ProjectAlpha' },
      { id: 'b', label: 'other' },
    ];
    const result = computeGraphSearch(asciiNodes, [], 'projectalpha', 1);
    expect(result.matchedIds).toEqual(new Set(['a']));
  });

  it('여러 노드가 매칭되면 각 매칭의 이웃 합집합을 노출한다', () => {
    // "이" → 이영희(n4). "회" 없음. 여기서는 "록"으로 회의록·독립노트 대신 회의록만 매칭 확인 대신
    // 다중 매칭: "프로젝트A"와 "이영희"를 모두 포함하는 검색은 없으므로 label 겹치는 케이스로 구성
    const multiNodes = [
      { id: 'x1', label: '노트-공통' },
      { id: 'x2', label: '공통-메모' },
      { id: 'x3', label: '연결' },
    ];
    const multiEdges = [{ source: 'x2', target: 'x3' }];
    const result = computeGraphSearch(multiNodes, multiEdges, '공통', 1);
    expect(result.matchedIds).toEqual(new Set(['x1', 'x2']));
    // x1은 고립, x2의 이웃 x3 포함
    expect(result.visibleIds).toEqual(new Set(['x1', 'x2', 'x3']));
  });

  it('매칭 없으면 visible도 비운다', () => {
    const result = computeGraphSearch(nodes, edges, '존재하지않는노트', 1);
    expect(result.matchedIds.size).toBe(0);
    expect(result.visibleIds.size).toBe(0);
  });

  it('고립 노드가 매칭되면 자기 자신만 visible', () => {
    const result = computeGraphSearch(nodes, edges, '독립노트', 1);
    expect(result.matchedIds).toEqual(new Set(['n5']));
    expect(result.visibleIds).toEqual(new Set(['n5']));
  });
});
