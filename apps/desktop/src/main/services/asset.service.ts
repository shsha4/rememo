import path from 'path';
import { fileService } from './file.service';

// vault 안에서 이미지가 저장되는 하위 디렉터리 (vault.service의 defaultAssetLocation과 동일).
const ASSET_DIR = 'Assets';

// 이미지 저장 실패 시 던지는 전용 에러. main 프로세스 IO 관심사이므로 core가 아닌 여기 둔다.
export class AssetSaveError extends Error {
  constructor(message: string) {
    super(`이미지 저장 실패: ${message}`);
    this.name = 'AssetSaveError';
  }
}

// MIME 타입 → 확장자 매핑. 지원하지 않는 타입은 null.
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
};

/** MIME 타입에서 파일 확장자(점 없음)를 얻는다. 미지원이면 null. */
export function extensionFromMime(mime: string): string | null {
  if (!mime) return null;
  return MIME_TO_EXT[mime.trim().toLowerCase()] ?? null;
}

/**
 * 파일명에서 경로 구분자와 파일시스템 위험 문자를 제거한다.
 * 한글 등 유니코드 문자는 보존한다.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, '') // 경로 구분자 제거 (디렉터리 탈출 방지)
    .replace(/[<>:"|?*]/g, '') // 파일시스템 예약 문자 (공백/하이픈은 보존)
    .replace(/\s+/g, '-') // 공백 → 하이픈
    .replace(/^\.+/, '') // 선행 점 제거 (숨김파일/상대경로 방지)
    .trim();
}

/**
 * 저장할 이미지 파일명을 만든다.
 * - originalName이 있으면(드래그앤드롭) 원본명을 정규화해 유지하고, 확장자가 없거나
 *   다르면 ext를 붙인다.
 * - originalName이 없으면(클립보드 붙여넣기) `Pasted-image-<timestamp>.<ext>`.
 */
export function buildAssetFilename(
  originalName: string | undefined,
  ext: string,
  timestamp: string,
): string {
  if (!originalName || !sanitizeFilename(path.basename(originalName))) {
    return `Pasted-image-${timestamp}.${ext}`;
  }

  const base = sanitizeFilename(path.basename(originalName));
  const currentExt = path.extname(base).slice(1).toLowerCase();

  // 이미 어떤 확장자를 갖고 있으면 그대로 둔다.
  if (currentExt) {
    return base;
  }

  // 확장자가 없으면 MIME에서 얻은 ext를 붙인다.
  return `${base}.${ext}`;
}

/**
 * `existsFn`으로 충돌을 검사하며 유일한 파일명을 만든다.
 * 충돌 시 `이름-1.ext`, `이름-2.ext` … 순으로 접미사를 붙인다.
 */
export async function uniqueFilename(
  desired: string,
  existsFn: (name: string) => Promise<boolean>,
): Promise<string> {
  if (!(await existsFn(desired))) {
    return desired;
  }

  const ext = path.extname(desired); // 점 포함 (예: ".png")
  const base = desired.slice(0, desired.length - ext.length);

  for (let i = 1; ; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!(await existsFn(candidate))) {
      return candidate;
    }
  }
}

/** Date → 파일명에 안전한 타임스탬프 문자열 (예: 20260706-153045123). */
function formatTimestamp(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
    `${pad(date.getMilliseconds(), 3)}`
  );
}

export class AssetService {
  /**
   * 이미지 바이너리를 vault의 Assets/ 디렉터리에 저장하고,
   * vault 루트 기준 상대경로(예: `Assets/Pasted-image-....png`)를 반환한다.
   */
  async saveImage(
    vaultPath: string,
    data: Uint8Array,
    mime: string,
    originalName?: string,
  ): Promise<string> {
    if (!vaultPath) {
      throw new AssetSaveError('vault 경로가 없습니다');
    }
    if (!data || data.length === 0) {
      throw new AssetSaveError('이미지 데이터가 비어 있습니다');
    }

    // 확장자 결정: MIME 우선, 없으면 원본 파일명의 확장자, 그것도 없으면 png.
    const ext =
      extensionFromMime(mime) ||
      (originalName ? path.extname(originalName).slice(1).toLowerCase() : '') ||
      'png';

    const timestamp = formatTimestamp(new Date());
    const desired = buildAssetFilename(originalName, ext, timestamp);
    const assetsDir = path.join(vaultPath, ASSET_DIR);

    // 유일 파일명을 고른 뒤 배타적(wx) 쓰기를 시도한다. 동시 저장으로 같은 이름이
    // 선점되면(EEXIST) 다음 후보로 재시도해 덮어쓰기/유실을 막는다.
    const MAX_ATTEMPTS = 1000;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const name = await uniqueFilename(desired, (candidate) =>
        fileService.fileExists(path.join(assetsDir, candidate)),
      );
      try {
        await fileService.writeBinaryFile(path.join(assetsDir, name), data, { exclusive: true });
        // 마크다운에는 항상 posix 구분자(/)로 넣는다.
        return `${ASSET_DIR}/${name}`;
      } catch (error) {
        if (isFileExistsError(error)) {
          continue; // 경쟁으로 방금 선점됨 → 다음 후보로.
        }
        throw new AssetSaveError(error instanceof Error ? error.message : String(error));
      }
    }
    throw new AssetSaveError('유일한 파일명을 찾지 못했습니다');
  }
}

/** fs의 EEXIST(이미 존재) 에러인지 검사한다. */
function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EEXIST'
  );
}

export const assetService = new AssetService();
