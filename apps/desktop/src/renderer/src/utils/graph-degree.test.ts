import { describe, it, expect } from 'vitest';
import { computeDegrees, degreeToDiameter } from './graph-degree';

describe('computeDegrees', () => {
  it('들어오는+나가는 링크를 모두 세어 degree를 계산한다', () => {
    const degrees = computeDegrees(
      ['a', 'b', 'c'],
      [
        { source: 'a', target: 'b' },
        { source: 'c', target: 'b' },
      ],
    );
    expect(degrees.get('a')).toBe(1); // 나가는 1
    expect(degrees.get('b')).toBe(2); // 들어오는 2
    expect(degrees.get('c')).toBe(1); // 나가는 1
  });

  it('엣지가 없으면 모든 노드 degree는 0', () => {
    const degrees = computeDegrees(['a', 'b'], []);
    expect(degrees.get('a')).toBe(0);
    expect(degrees.get('b')).toBe(0);
  });

  it('노드 목록에 없는 엣지 끝점은 무시한다', () => {
    const degrees = computeDegrees(['a'], [{ source: 'a', target: 'ghost' }]);
    expect(degrees.get('a')).toBe(1);
    expect(degrees.has('ghost')).toBe(false);
  });
});

describe('degreeToDiameter', () => {
  it('maxDegree가 0이면 최소 크기를 반환한다', () => {
    expect(degreeToDiameter(0, 0, 44, 120)).toBe(44);
  });

  it('degree=0이면 최소, degree=max면 최대 크기', () => {
    expect(degreeToDiameter(0, 10, 44, 120)).toBe(44);
    expect(degreeToDiameter(10, 10, 44, 120)).toBe(120);
  });

  it('sqrt 스케일이라 중간 degree는 선형 중간값보다 크다', () => {
    // ratio=0.25 → sqrt=0.5 → 정확히 중간 크기
    const mid = degreeToDiameter(1, 4, 40, 120);
    expect(mid).toBe(80);
  });

  it('degree가 max를 넘어도 최대 크기로 클램프된다', () => {
    expect(degreeToDiameter(999, 10, 44, 120)).toBe(120);
  });
});
