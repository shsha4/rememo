import type { Center } from './graph-layout';

/**
 * 그래프의 카테고리 박스 계산(순수 함수). 노트 노드는 자유 배치하되, 같은 카테고리 노드끼리
 * 화면상 뭉치도록 앵커를 주고, 그 노드들을 감싸는 사각형(박스)을 계산한다.
 */

export interface CategoryBox {
  /** 노트 루트 기준 상대 카테고리 경로(예: "카프카", "카프카/내부"). */
  category: string;
  /** 박스 라벨(카테고리 마지막 세그먼트). */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 카테고리들을 화면상 서로 떨어진 앵커 좌표(원형 배열)에 매핑한다. 클러스터링 힘의 목표점.
 * 단일 카테고리는 원점에 둔다.
 */
export function assignCategoryAnchors(categories: string[], radius = 700): Map<string, Center> {
  const anchors = new Map<string, Center>();
  const uniq = [...new Set(categories.filter(Boolean))].sort();
  const n = uniq.length;
  uniq.forEach((cat, i) => {
    if (n === 1) {
      anchors.set(cat, { x: 0, y: 0 });
      return;
    }
    const angle = (2 * Math.PI * i) / n;
    anchors.set(cat, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return anchors;
}

export interface BoxInputNode {
  id: string;
  /** 노드 중심 좌표. */
  x: number;
  y: number;
  /** 노드 반지름. */
  r: number;
  /** 노드가 속한 카테고리(루트='' 는 박스 없음). */
  category: string;
}

/**
 * 같은 카테고리 노드들을 감싸는 박스를 계산한다(패딩 + 상단 라벨 공간 포함).
 * 중첩 카테고리 시 겹칠 수 있으므로, 큰 박스가 먼저(뒤에) 오도록 넓이 내림차순 정렬한다.
 */
export function computeCategoryBoxes(
  nodes: BoxInputNode[],
  opts: { padding?: number; labelHeight?: number } = {},
): CategoryBox[] {
  const padding = opts.padding ?? 44;
  const labelHeight = opts.labelHeight ?? 30;

  const groups = new Map<string, BoxInputNode[]>();
  for (const node of nodes) {
    if (!node.category) continue; // 루트 노트는 박스 없음
    const members = groups.get(node.category);
    if (members) members.push(node);
    else groups.set(node.category, [node]);
  }

  const boxes: CategoryBox[] = [];
  for (const [category, members] of groups) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of members) {
      minX = Math.min(minX, m.x - m.r);
      minY = Math.min(minY, m.y - m.r);
      maxX = Math.max(maxX, m.x + m.r);
      maxY = Math.max(maxY, m.y + m.r);
    }
    const name = category.includes('/') ? category.slice(category.lastIndexOf('/') + 1) : category;
    boxes.push({
      category,
      name,
      x: minX - padding,
      y: minY - padding - labelHeight,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + labelHeight,
    });
  }

  boxes.sort((a, b) => b.width * b.height - a.width * a.height);
  return boxes;
}

/**
 * 점(x,y)이 들어가는 박스를 반환한다. 여러 개면 가장 작은(=가장 구체적인) 박스를 고른다.
 * 어느 박스에도 없으면 null(=루트로 취급).
 */
export function findBoxAtPoint(boxes: CategoryBox[], x: number, y: number): CategoryBox | null {
  const containing = boxes.filter(
    (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height,
  );
  if (containing.length === 0) return null;
  containing.sort((a, b) => a.width * a.height - b.width * b.height);
  return containing[0];
}
