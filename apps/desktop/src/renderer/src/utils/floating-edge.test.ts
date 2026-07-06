import { describe, it, expect } from 'vitest';
import { getCircleEdgeParams } from './floating-edge';

describe('getCircleEdgeParams', () => {
  it('수평으로 떨어진 두 원의 경계점을 계산한다', () => {
    const result = getCircleEdgeParams({ x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 20 });
    // source 오른쪽 경계(+r), target 왼쪽 경계(-r)
    expect(result.sx).toBe(10);
    expect(result.sy).toBe(0);
    expect(result.tx).toBe(80);
    expect(result.ty).toBe(0);
  });

  it('수직으로 떨어진 두 원의 경계점을 계산한다', () => {
    const result = getCircleEdgeParams({ x: 0, y: 0, r: 5 }, { x: 0, y: 50, r: 5 });
    expect(result.sx).toBe(0);
    expect(result.sy).toBe(5);
    expect(result.tx).toBe(0);
    expect(result.ty).toBe(45);
  });

  it('중심이 겹쳐도 0 나눗셈 없이 유한한 값을 반환한다', () => {
    const result = getCircleEdgeParams({ x: 10, y: 10, r: 5 }, { x: 10, y: 10, r: 5 });
    expect(Number.isFinite(result.sx)).toBe(true);
    expect(Number.isFinite(result.sy)).toBe(true);
    expect(Number.isFinite(result.tx)).toBe(true);
    expect(Number.isFinite(result.ty)).toBe(true);
  });

  it('대각선 방향에서도 경계점이 원 위에 놓인다(거리=반지름)', () => {
    const source = { x: 0, y: 0, r: 10 };
    const target = { x: 30, y: 40, r: 10 };
    const { sx, sy } = getCircleEdgeParams(source, target);
    const distFromCenter = Math.hypot(sx - source.x, sy - source.y);
    expect(distFromCenter).toBeCloseTo(10, 5);
  });
});
