// main/protocol/asset-protocol.ts의 ASSET_PROTOCOL과 반드시 동일해야 한다.
// (렌더러는 main 모듈을 import할 수 없어 스킴 문자열만 공유한다.)
export const ASSET_PROTOCOL = 'rememo-asset';

/** src가 스킴을 가진 외부 URL(http:, data:, // …)인지 검사한다. */
function isExternalUrl(src: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src) || src.startsWith('//');
}

/**
 * 마크다운 이미지 src를 프리뷰에서 로드 가능한 URL로 변환한다.
 * - 외부 URL(http/data 등)은 그대로 둔다.
 * - vault 상대경로(예: `Assets/x.png`)는 vaultPath와 합쳐 `rememo-asset://` URL로 만든다.
 * - vaultPath가 없으면 원본을 그대로 반환한다.
 */
export function toAssetUrl(src: string, vaultPath: string | null | undefined): string {
  if (!src || isExternalUrl(src)) return src;
  if (!vaultPath) return src;

  // react-markdown은 파싱 단계에서 URL의 비ASCII/공백을 이미 percent-encoding 해서
  // src로 넘긴다(예: 어 → %EC%96%B4). 여기서 다시 인코딩하면 %가 %25로 이중
  // 인코딩되어 파일을 못 찾는다. 먼저 디코딩해 원본 상대경로를 얻은 뒤 한 번만 인코딩한다.
  let rawSrc: string;
  try {
    rawSrc = decodeURIComponent(src);
  } catch {
    rawSrc = src;
  }

  const cleanSrc = rawSrc.replace(/^\.\//, '').replace(/^\/+/, '');

  // vault 밖으로 나가는 `..` 세그먼트가 있으면 로드하지 않는다 (경로 탈출 방지).
  if (cleanSrc.split(/[/\\]/).includes('..')) return '';

  const cleanVault = vaultPath.replace(/[/\\]+$/, '');
  const absolutePath = `${cleanVault}/${cleanSrc}`;
  return `${ASSET_PROTOCOL}://asset/${encodeURIComponent(absolutePath)}`;
}
