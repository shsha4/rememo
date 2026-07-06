// 그래프 노드의 연결 수(degree)와 이를 원 크기로 매핑하는 순수 함수.
// 연결이 많은 노드일수록 원이 커지도록 그래프 시각화에 사용한다.

export interface DegreeEdge {
  source: string;
  target: string;
}

// 각 노드의 전체 연결 수(들어오는 + 나가는 링크)를 센다.
export function computeDegrees(nodeIds: string[], edges: DegreeEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  nodeIds.forEach((id) => degrees.set(id, 0));

  edges.forEach((edge) => {
    if (degrees.has(edge.source)) {
      degrees.set(edge.source, degrees.get(edge.source)! + 1);
    }
    if (degrees.has(edge.target)) {
      degrees.set(edge.target, degrees.get(edge.target)! + 1);
    }
  });

  return degrees;
}

/**
 * degree를 원의 지름(px)으로 매핑한다.
 * - 면적감이 자연스럽도록 sqrt 스케일을 쓴다(연결 수가 선형으로 늘어도 원이 과하게 커지지 않음).
 * - maxDegree가 0(엣지 없음)이면 모두 최소 크기.
 */
export function degreeToDiameter(degree: number, maxDegree: number, min = 44, max = 120): number {
  if (maxDegree <= 0) return min;
  const ratio = Math.min(Math.max(degree, 0), maxDegree) / maxDegree;
  return Math.round(min + (max - min) * Math.sqrt(ratio));
}
