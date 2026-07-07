import { describe, it, expect } from 'vitest';
import {
  assignCategoryAnchors,
  computeCategoryBoxes,
  findBoxAtPoint,
  type BoxInputNode,
} from './graph-categories';

describe('assignCategoryAnchors', () => {
  it('단일 카테고리는 원점에 둔다', () => {
    const anchors = assignCategoryAnchors(['카프카']);
    expect(anchors.get('카프카')).toEqual({ x: 0, y: 0 });
  });

  it('여러 카테고리를 서로 다른 좌표에 분산한다', () => {
    const anchors = assignCategoryAnchors(['카프카', '엘라스틱', '레디스']);
    expect(anchors.size).toBe(3);
    const points = [...anchors.values()];
    // 서로 다른 좌표여야 한다.
    const unique = new Set(points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    expect(unique.size).toBe(3);
  });

  it('빈 카테고리(루트)는 앵커에서 제외한다', () => {
    const anchors = assignCategoryAnchors(['', '카프카', '']);
    expect(anchors.has('')).toBe(false);
    expect(anchors.has('카프카')).toBe(true);
  });
});

describe('computeCategoryBoxes', () => {
  const nodes: BoxInputNode[] = [
    { id: 'a', x: 0, y: 0, r: 20, category: '카프카' },
    { id: 'b', x: 100, y: 0, r: 20, category: '카프카' },
    { id: 'c', x: 0, y: 300, r: 20, category: '엘라스틱' },
    { id: 'root', x: 500, y: 500, r: 20, category: '' },
  ];

  it('카테고리별로 멤버 노드를 감싸는 박스를 만든다(루트 제외)', () => {
    const boxes = computeCategoryBoxes(nodes, { padding: 10, labelHeight: 20 });
    expect(boxes.map((b) => b.category).sort()).toEqual(['엘라스틱', '카프카']);
  });

  it('박스는 멤버 노드 원을 패딩·라벨 높이만큼 여유있게 감싼다', () => {
    const boxes = computeCategoryBoxes(nodes, { padding: 10, labelHeight: 20 });
    const kafka = boxes.find((b) => b.category === '카프카')!;
    // x: minX(-20) - padding(10) = -30
    expect(kafka.x).toBe(-30);
    // width: (maxX 120 - minX -20) + padding*2 = 140 + 20 = 160
    expect(kafka.width).toBe(160);
    // y: minY(-20) - padding(10) - labelHeight(20) = -50
    expect(kafka.y).toBe(-50);
  });

  it('중첩 카테고리 경로는 마지막 세그먼트를 라벨로 쓴다', () => {
    const boxes = computeCategoryBoxes([{ id: 'x', x: 0, y: 0, r: 10, category: '카프카/내부' }]);
    expect(boxes[0].name).toBe('내부');
  });

  it('큰 박스가 먼저(뒤에 그려지도록) 정렬된다', () => {
    const boxes = computeCategoryBoxes(nodes, { padding: 10, labelHeight: 20 });
    for (let i = 1; i < boxes.length; i++) {
      const prev = boxes[i - 1].width * boxes[i - 1].height;
      const cur = boxes[i].width * boxes[i].height;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });
});

describe('findBoxAtPoint', () => {
  const boxes = computeCategoryBoxes(
    [
      { id: 'a', x: 0, y: 0, r: 20, category: '카프카' },
      { id: 'b', x: 100, y: 0, r: 20, category: '카프카' },
      { id: 'c', x: 600, y: 0, r: 20, category: '엘라스틱' },
    ],
    { padding: 10, labelHeight: 20 },
  );

  it('점이 든 박스를 반환한다', () => {
    expect(findBoxAtPoint(boxes, 50, 0)?.category).toBe('카프카');
    expect(findBoxAtPoint(boxes, 600, 0)?.category).toBe('엘라스틱');
  });

  it('어느 박스에도 없으면 null', () => {
    expect(findBoxAtPoint(boxes, 5000, 5000)).toBeNull();
  });

  it('여러 박스에 겹치면 더 작은(구체적인) 박스를 고른다', () => {
    const nested = [
      { category: '부모', name: '부모', x: 0, y: 0, width: 400, height: 400 },
      { category: '부모/자식', name: '자식', x: 50, y: 50, width: 100, height: 100 },
    ];
    expect(findBoxAtPoint(nested, 80, 80)?.category).toBe('부모/자식');
  });
});
