import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  extensionFromMime,
  sanitizeFilename,
  buildAssetFilename,
  uniqueFilename,
  assetService,
  AssetSaveError,
} from './asset.service';

describe('extensionFromMime', () => {
  it('png/jpeg/gif/webp 등 대표 이미지 MIME을 확장자로 변환한다', () => {
    expect(extensionFromMime('image/png')).toBe('png');
    expect(extensionFromMime('image/jpeg')).toBe('jpg');
    expect(extensionFromMime('image/gif')).toBe('gif');
    expect(extensionFromMime('image/webp')).toBe('webp');
    expect(extensionFromMime('image/svg+xml')).toBe('svg');
  });

  it('대소문자/공백이 섞여도 정규화해 매칭한다', () => {
    expect(extensionFromMime('IMAGE/PNG')).toBe('png');
    expect(extensionFromMime('  image/jpeg  ')).toBe('jpg');
  });

  it('지원하지 않는 MIME이나 빈 값이면 null을 반환한다', () => {
    expect(extensionFromMime('application/pdf')).toBeNull();
    expect(extensionFromMime('text/plain')).toBeNull();
    expect(extensionFromMime('')).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it('경로 구분자를 제거해 디렉터리 탈출을 막는다', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('a/b\\c.png')).toBe('abc.png');
  });

  it('공백은 하이픈으로 바꾼다', () => {
    expect(sanitizeFilename('my photo.png')).toBe('my-photo.png');
    expect(sanitizeFilename('screen shot 2026.png')).toBe('screen-shot-2026.png');
  });

  it('파일시스템 예약/위험 문자를 제거한다', () => {
    expect(sanitizeFilename('a<b>c:d"e|f?g*h.png')).toBe('abcdefgh.png');
  });

  it('선행 점을 제거해 숨김파일/상대경로화를 막는다', () => {
    expect(sanitizeFilename('...hidden.png')).toBe('hidden.png');
  });

  it('한글 파일명은 그대로 보존한다', () => {
    expect(sanitizeFilename('사진.png')).toBe('사진.png');
    expect(sanitizeFilename('회의 자료.png')).toBe('회의-자료.png');
  });
});

describe('buildAssetFilename', () => {
  const TS = '20260706-153045123';

  it('원본명이 없으면(붙여넣기) Pasted-image-<timestamp> 규칙을 쓴다', () => {
    expect(buildAssetFilename(undefined, 'png', TS)).toBe(`Pasted-image-${TS}.png`);
  });

  it('원본명이 정규화 후 비면 붙여넣기 규칙으로 폴백한다', () => {
    expect(buildAssetFilename('///', 'png', TS)).toBe(`Pasted-image-${TS}.png`);
  });

  it('원본명(드롭)에 확장자가 있으면 그대로 유지한다', () => {
    expect(buildAssetFilename('diagram.png', 'png', TS)).toBe('diagram.png');
  });

  it('원본명에 확장자가 없으면 MIME에서 얻은 확장자를 붙인다', () => {
    expect(buildAssetFilename('diagram', 'png', TS)).toBe('diagram.png');
  });

  it('한글 원본명과 공백을 정규화하되 확장자는 유지한다', () => {
    expect(buildAssetFilename('회의 자료.jpg', 'jpg', TS)).toBe('회의-자료.jpg');
  });

  it('경로가 포함된 원본명은 basename만 사용한다', () => {
    expect(buildAssetFilename('/Users/me/Pictures/cat.png', 'png', TS)).toBe('cat.png');
  });
});

describe('uniqueFilename', () => {
  it('충돌이 없으면 원하는 이름을 그대로 반환한다', async () => {
    const result = await uniqueFilename('cat.png', async () => false);
    expect(result).toBe('cat.png');
  });

  it('충돌 시 -1, -2 … 순으로 접미사를 붙인다', async () => {
    const taken = new Set(['cat.png', 'cat-1.png']);
    const result = await uniqueFilename('cat.png', async (name) => taken.has(name));
    expect(result).toBe('cat-2.png');
  });

  it('확장자가 없는 이름도 접미사를 올바르게 붙인다', async () => {
    const taken = new Set(['README']);
    const result = await uniqueFilename('README', async (name) => taken.has(name));
    expect(result).toBe('README-1');
  });

  it('한글 파일명 충돌도 처리한다', async () => {
    const taken = new Set(['사진.png']);
    const result = await uniqueFilename('사진.png', async (name) => taken.has(name));
    expect(result).toBe('사진-1.png');
  });
});

// 실제 임시 디렉터리에 저장하는 통합 테스트 (파일 IO 실측).
describe('AssetService.saveImage (통합)', () => {
  let vaultPath: string;
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG 시그니처

  beforeEach(async () => {
    vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), 'rememo-asset-'));
  });

  afterEach(async () => {
    await fs.rm(vaultPath, { recursive: true, force: true });
  });

  it('붙여넣기 이미지를 Assets/에 저장하고 상대경로를 반환한다', async () => {
    const rel = await assetService.saveImage(vaultPath, PNG, 'image/png');
    expect(rel).toMatch(/^Assets\/Pasted-image-\d{8}-\d{9}\.png$/);
    const saved = await fs.readFile(path.join(vaultPath, rel));
    expect(new Uint8Array(saved)).toEqual(PNG);
  });

  it('드롭 이미지는 원본 파일명을 유지한다', async () => {
    const rel = await assetService.saveImage(vaultPath, PNG, 'image/png', 'diagram.png');
    expect(rel).toBe('Assets/diagram.png');
  });

  it('같은 이름이 이미 있으면 -1 접미사로 충돌을 피하고 원본을 보존한다', async () => {
    const first = await assetService.saveImage(vaultPath, PNG, 'image/png', 'diagram.png');
    const other = new Uint8Array([1, 2, 3, 4]);
    const second = await assetService.saveImage(vaultPath, other, 'image/png', 'diagram.png');

    expect(first).toBe('Assets/diagram.png');
    expect(second).toBe('Assets/diagram-1.png');
    // 첫 파일이 덮어써지지 않았는지 확인.
    expect(new Uint8Array(await fs.readFile(path.join(vaultPath, first)))).toEqual(PNG);
    expect(new Uint8Array(await fs.readFile(path.join(vaultPath, second)))).toEqual(other);
  });

  it('동시(병렬) 저장에도 서로 다른 파일로 저장되어 유실이 없다', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        assetService.saveImage(vaultPath, new Uint8Array([i]), 'image/png', 'shot.png'),
      ),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(5); // 5개 모두 고유 경로
    const files = await fs.readdir(path.join(vaultPath, 'Assets'));
    expect(files.length).toBe(5);
  });

  it('빈 데이터면 AssetSaveError를 던진다', async () => {
    await expect(assetService.saveImage(vaultPath, new Uint8Array(), 'image/png')).rejects.toThrow(
      AssetSaveError,
    );
  });
});
