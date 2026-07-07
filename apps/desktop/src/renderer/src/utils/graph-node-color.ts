// 그래프 노드 색 계산(순수 함수).
// 색은 두 가지를 함께 담는다: **카테고리(폴더)=색상(hue)**, **연결 깊이(depth)=음영(밝기)**.
// (연결 수는 노드 크기로 표현되므로 색에는 쓰지 않는다.)
// 흰색 라벨이 얹히므로 팔레트는 중간~진한 톤으로만 유지해 대비를 확보한다.

// 카테고리별 기본 색(구분 잘 되는 중간 톤).
const CATEGORY_PALETTE = [
  '#3f77c4', // blue
  '#3f8f7d', // teal
  '#9c7030', // ochre
  '#8f5285', // mauve
  '#b05a5a', // red
  '#5f7bb0', // slate
  '#6f8f3f', // olive
  '#8a6bb0', // violet
];

// 카테고리가 없는(루트) 노트의 색.
export const UNCATEGORIZED_COLOR = '#6b7076';

/**
 * 등장하는 카테고리들에 팔레트 색을 결정적으로 배정한다(이름 정렬 후 순서대로, 초과 시 순환).
 * 빈 문자열('' = 루트/카테고리 없음)은 제외한다.
 */
export function assignCategoryColors(categories: string[]): Map<string, string> {
  const unique = [...new Set(categories.filter((c) => c !== ''))].sort();
  const map = new Map<string, string>();
  unique.forEach((category, i) => {
    map.set(category, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]);
  });
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 카테고리 기본색을 깊이에 따라 음영 처리한다. 깊을수록 살짝 진하게(루트가 가장 밝음).
 * 밝기는 26~62% 범위로 클램프해 흰색 라벨 대비를 지킨다.
 */
export function nodeColor(baseHex: string, depth: number): string {
  const { h, s, l } = hexToHsl(baseHex);
  const shifted = clamp(l - clamp(depth, 0, 4) * 5, 26, 62);
  return hslToHex({ h, s, l: shifted });
}
