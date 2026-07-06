import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force';
import type { Node, Edge } from 'reactflow';

// d3-force를 이용한 유기적(force-directed) 배치.
// 로드 시 시뮬레이션을 정해진 횟수만큼 수렴시켜 정적 좌표를 만들고 reactflow position에 반영한다.
// (dagre 계층 트리와 달리 노드가 자연스럽게 퍼지며, 원형+degree 크기 디자인에 어울린다.)

export interface Center {
  x: number;
  y: number;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  // 각 노드의 중심 좌표. 다음 새로고침 때 이 값을 fixedCenters로 넘기면 배치가 유지된다.
  centers: Map<string, Center>;
}

interface SimNode {
  id: string;
  r: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// 노드 data.size(지름)에서 반지름을 얻는다(없으면 기본값).
function nodeRadius(node: Node): number {
  return ((node.data?.size as number) ?? 48) / 2;
}

// 중심 좌표(center)를 reactflow position(좌상단 기준)으로 변환한다.
function toPositioned(node: Node, center: Center): Node {
  const r = nodeRadius(node);
  return { ...node, position: { x: center.x - r, y: center.y - r } };
}

/**
 * force-directed 배치를 계산한다.
 * @param fixedCenters 이전 배치의 중심 좌표. 여기 있는 노드는 위치를 고정(fx/fy)해
 *   새로고침 시 기존 노드가 제자리에 머물고 새 노드만 주변에 자리잡게 한다(배치 안정화).
 */
export function getForceLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  fixedCenters?: Map<string, Center>,
): LayoutResult {
  if (nodes.length === 0) {
    return { nodes, edges, centers: new Map() };
  }

  const fixed = fixedCenters ?? new Map<string, Center>();

  // 모든 노드 위치가 캐시돼 있으면(새 노드 없음) 시뮬레이션 없이 캐시 좌표를 그대로 적용한다.
  // → 새로고침해도 배치가 섞이지 않고 그대로 유지된다.
  const allFixed = nodes.every((node) => fixed.has(node.id));
  if (allFixed) {
    const centers = new Map<string, Center>();
    const layoutedNodes = nodes.map((node) => {
      const center = fixed.get(node.id)!;
      centers.set(node.id, center);
      return toPositioned(node, center);
    });
    return { nodes: layoutedNodes, edges, centers };
  }

  const simNodes: SimNode[] = nodes.map((node) => {
    const r = nodeRadius(node);
    const center = fixed.get(node.id);
    // 기존(캐시된) 노드는 fx/fy로 고정하고, 새 노드만 자유롭게 시뮬레이션한다.
    return center
      ? { id: node.id, r, x: center.x, y: center.y, fx: center.x, fy: center.y }
      : { id: node.id, r };
  });
  const simLinks = edges.map((edge) => ({ source: edge.source, target: edge.target }));

  const simulation = forceSimulation<SimNode>(simNodes)
    .force('charge', forceManyBody().strength(-400))
    .force(
      'link',
      forceLink<SimNode, (typeof simLinks)[number]>(simLinks)
        .id((d) => d.id)
        .distance(140)
        .strength(0.4),
    )
    .force('center', forceCenter(0, 0))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((d) => d.r + 12)
        .strength(0.9),
    )
    // 고립 노드가 무한정 멀어지지 않도록 원점으로 약하게 당긴다.
    .force('x', forceX(0).strength(0.06))
    .force('y', forceY(0).strength(0.06))
    .stop();

  const iterations = 300;
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  const centers = new Map<string, Center>();
  simNodes.forEach((n) => centers.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }));

  const layoutedNodes = nodes.map((node) => toPositioned(node, centers.get(node.id)!));

  return { nodes: layoutedNodes, edges, centers };
}
