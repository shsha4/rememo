// 원형 노드용 floating 엣지 기하 계산(순수 함수).
// 두 원의 중심을 잇는 직선이 각 원의 경계와 만나는 점을 구해, 엣지가 원 테두리에서
// 시작/끝나도록 한다(중심에서 시작하면 큰 원 안으로 선이 파고들어 보기 나쁨).

export interface Circle {
  x: number; // 중심 x
  y: number; // 중심 y
  r: number; // 반지름
}

export interface EdgeEndpoints {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export function getCircleEdgeParams(source: Circle, target: Circle): EdgeEndpoints {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy) || 1; // 두 중심이 겹치면 0 나눗셈 방지
  const ux = dx / dist;
  const uy = dy / dist;

  return {
    sx: source.x + ux * source.r,
    sy: source.y + uy * source.r,
    tx: target.x - ux * target.r,
    ty: target.y - uy * target.r,
  };
}
