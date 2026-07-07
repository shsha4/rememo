import { describe, it, expect } from 'vitest';
import { assignCategoryColors, nodeColor, UNCATEGORIZED_COLOR } from './graph-node-color';

describe('assignCategoryColors', () => {
  it('빈 문자열(루트)은 제외하고 유일 카테고리에만 색을 배정한다', () => {
    const map = assignCategoryColors(['a', '', 'b', 'a', '']);
    expect(map.has('')).toBe(false);
    expect(map.size).toBe(2);
    expect(map.get('a')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('이름 정렬 기준으로 결정적으로 배정한다(호출 순서 무관)', () => {
    const m1 = assignCategoryColors(['b', 'a', 'c']);
    const m2 = assignCategoryColors(['c', 'b', 'a']);
    expect(m1.get('a')).toBe(m2.get('a'));
    expect(m1.get('b')).toBe(m2.get('b'));
  });

  it('팔레트를 넘는 카테고리는 색을 순환 재사용한다', () => {
    const many = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const map = assignCategoryColors(many);
    expect(map.size).toBe(10);
    // 9번째(인덱스 8)는 팔레트 길이 8을 넘어 0번과 같은 색으로 순환한다.
    expect(map.get('c0')).toBe(map.get('c8'));
  });
});

describe('nodeColor', () => {
  it('항상 유효한 hex를 반환한다', () => {
    expect(nodeColor('#3f77c4', 0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(nodeColor(UNCATEGORIZED_COLOR, 2)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('깊을수록 더 진해진다(밝기가 단조 감소, 클램프 전 구간)', () => {
    const lum = (hex: string) => {
      const n = hex.replace('#', '');
      return (
        parseInt(n.slice(0, 2), 16) + parseInt(n.slice(2, 4), 16) + parseInt(n.slice(4, 6), 16)
      );
    };
    const d0 = lum(nodeColor('#3f77c4', 0));
    const d1 = lum(nodeColor('#3f77c4', 1));
    const d2 = lum(nodeColor('#3f77c4', 2));
    expect(d1).toBeLessThan(d0);
    expect(d2).toBeLessThan(d1);
  });

  it('깊이가 매우 커도 밝기 하한(클램프) 아래로 내려가지 않는다', () => {
    expect(nodeColor('#3f77c4', 4)).toBe(nodeColor('#3f77c4', 99));
  });
});
