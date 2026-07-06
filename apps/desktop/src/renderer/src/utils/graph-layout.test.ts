import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { getForceLayoutedElements } from './graph-layout';

function makeNode(id: string, size = 48): Node {
  return { id, position: { x: 0, y: 0 }, data: { label: id, size } };
}

describe('getForceLayoutedElements', () => {
  it('빈 그래프는 그대로 반환한다', () => {
    const result = getForceLayoutedElements([], []);
    expect(result.nodes).toEqual([]);
    expect(result.centers.size).toBe(0);
  });

  it('모든 노드가 fixedCenters에 있으면 시뮬레이션 없이 캐시 좌표를 그대로 유지한다(배치 안정화)', () => {
    const nodes = [makeNode('a', 40), makeNode('b', 80)];
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    const fixed = new Map([
      ['a', { x: 100, y: 100 }],
      ['b', { x: 300, y: 300 }],
    ]);

    const result = getForceLayoutedElements(nodes, edges, fixed);

    // centers는 입력 그대로 유지
    expect(result.centers.get('a')).toEqual({ x: 100, y: 100 });
    expect(result.centers.get('b')).toEqual({ x: 300, y: 300 });

    // position은 중심 - 반지름(size/2)
    const a = result.nodes.find((n) => n.id === 'a')!;
    const b = result.nodes.find((n) => n.id === 'b')!;
    expect(a.position).toEqual({ x: 100 - 20, y: 100 - 20 });
    expect(b.position).toEqual({ x: 300 - 40, y: 300 - 40 });
  });

  it('모든 노드에 유한한 좌표를 부여한다', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    const result = getForceLayoutedElements(nodes, edges);

    expect(result.nodes).toHaveLength(3);
    result.nodes.forEach((n) => {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    });
    expect(result.centers.size).toBe(3);
  });

  it('고정된 노드는 제자리를 지키고 새 노드만 배치된다', () => {
    const nodes = [makeNode('old'), makeNode('new')];
    const edges: Edge[] = [{ id: 'e1', source: 'old', target: 'new' }];
    const fixed = new Map([['old', { x: 0, y: 0 }]]);

    const result = getForceLayoutedElements(nodes, edges, fixed);

    // 고정 노드 old는 중심 (0,0) 유지
    expect(result.centers.get('old')).toEqual({ x: 0, y: 0 });
    // 새 노드 new는 유한한 좌표를 얻음
    const newCenter = result.centers.get('new')!;
    expect(Number.isFinite(newCenter.x)).toBe(true);
    expect(Number.isFinite(newCenter.y)).toBe(true);
  });
});
