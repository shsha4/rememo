import { describe, it, expect, vi } from 'vitest';

// asset-protocol 모듈은 electron의 protocol을 import한다. 순수 함수만 테스트하므로 모킹한다.
vi.mock('electron', () => ({
  protocol: { handle: vi.fn() },
}));

import { buildAssetUrl, assetUrlToPath, mimeFromPath, ASSET_PROTOCOL } from './asset-protocol';

describe('buildAssetUrl / assetUrlToPath', () => {
  it('절대경로를 rememo-asset:// URL로 인코딩한다', () => {
    const url = buildAssetUrl('/Users/me/vault/Assets/cat.png');
    expect(url.startsWith(`${ASSET_PROTOCOL}://asset/`)).toBe(true);
  });

  it('인코딩 후 다시 디코딩하면 원래 경로로 복원된다(왕복)', () => {
    const original = '/Users/me/vault/Assets/cat.png';
    expect(assetUrlToPath(buildAssetUrl(original))).toBe(original);
  });

  it('공백/한글이 포함된 경로도 왕복 보존한다', () => {
    const original = '/Users/me/내 볼트/Assets/회의 자료.png';
    expect(assetUrlToPath(buildAssetUrl(original))).toBe(original);
  });

  it('경로 구분자(/)도 인코딩되어 단일 세그먼트로 왕복된다', () => {
    const original = '/a/b/c/d.png';
    const url = buildAssetUrl(original);
    // 실제 슬래시는 %2F로 인코딩되어 URL에 남지 않는다.
    expect(url.slice(`${ASSET_PROTOCOL}://asset/`.length)).not.toContain('/');
    expect(assetUrlToPath(url)).toBe(original);
  });

  it('스킴이 다른 URL이면 null을 반환한다', () => {
    expect(assetUrlToPath('http://example.com/a.png')).toBeNull();
    expect(assetUrlToPath('file:///a.png')).toBeNull();
  });

  it('경로 부분이 비어 있으면 null을 반환한다', () => {
    expect(assetUrlToPath(`${ASSET_PROTOCOL}://asset/`)).toBeNull();
  });
});

describe('mimeFromPath', () => {
  it('이미지 확장자를 content-type으로 매핑한다', () => {
    expect(mimeFromPath('/x/cat.png')).toBe('image/png');
    expect(mimeFromPath('/x/cat.jpg')).toBe('image/jpeg');
    expect(mimeFromPath('/x/cat.jpeg')).toBe('image/jpeg');
    expect(mimeFromPath('/x/cat.svg')).toBe('image/svg+xml');
  });

  it('확장자 대소문자를 구분하지 않는다', () => {
    expect(mimeFromPath('/x/CAT.PNG')).toBe('image/png');
  });

  it('이미지가 아닌 확장자나 확장자 없음이면 null을 반환한다', () => {
    expect(mimeFromPath('/x/note.md')).toBeNull();
    expect(mimeFromPath('/x/passwd')).toBeNull();
  });
});
