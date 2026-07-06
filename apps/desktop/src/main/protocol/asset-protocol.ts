import { protocol } from 'electron';
import fs from 'fs/promises';
import path from 'path';

// vault 로컬 이미지를 렌더러에 안전하게 서빙하기 위한 커스텀 스킴.
// (기본 webSecurity=true 이므로 file:// 직접 로드는 차단된다.)
export const ASSET_PROTOCOL = 'rememo-asset';

// 이 스킴으로 서빙을 허용하는 이미지 확장자 → content-type.
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

/**
 * 절대 파일 경로를 `rememo-asset://` URL로 인코딩한다. (렌더러가 <img src>에 쓴다)
 * 경로 전체를 encodeURIComponent로 감싸 단일 세그먼트로 만든다.
 */
export function buildAssetUrl(absolutePath: string): string {
  return `${ASSET_PROTOCOL}://asset/${encodeURIComponent(absolutePath)}`;
}

/**
 * `rememo-asset://` URL을 원래의 절대 파일 경로로 되돌린다.
 * 형식이 아니면 null.
 */
export function assetUrlToPath(url: string): string | null {
  const prefix = `${ASSET_PROTOCOL}://asset/`;
  if (!url.startsWith(prefix)) return null;
  const encoded = url.slice(prefix.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** 확장자로 content-type을 얻는다. 이미지가 아니면 null. */
export function mimeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export function setupAssetProtocol(): void {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    const filePath = assetUrlToPath(request.url);
    if (!filePath) {
      return new Response(null, { status: 400 });
    }

    // 경로 탈출 방어: `..` 세그먼트가 있으면 거부한다 (renderer 방어의 이중화).
    if (filePath.split(/[/\\]/).includes('..')) {
      return new Response(null, { status: 403 });
    }

    // 이미지 확장자만 서빙한다 (임의 로컬 파일 노출 최소화).
    const mime = mimeFromPath(filePath);
    if (!mime) {
      return new Response(null, { status: 403 });
    }

    try {
      const data = await fs.readFile(filePath);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: { 'content-type': mime },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
