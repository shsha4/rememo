import { describe, it, expect } from 'vitest';
import { toAssetUrl, ASSET_PROTOCOL } from './asset-url';

const VAULT = '/Users/me/vault';

describe('toAssetUrl', () => {
  it('vault 상대경로를 rememo-asset:// URL로 변환한다', () => {
    const url = toAssetUrl('Assets/cat.png', VAULT);
    expect(url).toBe(
      `${ASSET_PROTOCOL}://asset/${encodeURIComponent('/Users/me/vault/Assets/cat.png')}`,
    );
  });

  it('선행 ./ 와 / 를 정리한 뒤 결합한다', () => {
    expect(toAssetUrl('./Assets/cat.png', VAULT)).toBe(toAssetUrl('Assets/cat.png', VAULT));
    expect(toAssetUrl('/Assets/cat.png', VAULT)).toBe(toAssetUrl('Assets/cat.png', VAULT));
  });

  it('vault 경로 끝의 슬래시는 중복되지 않는다', () => {
    expect(toAssetUrl('Assets/cat.png', '/Users/me/vault/')).toBe(
      toAssetUrl('Assets/cat.png', VAULT),
    );
  });

  it('http/https 외부 이미지는 그대로 둔다', () => {
    expect(toAssetUrl('https://example.com/a.png', VAULT)).toBe('https://example.com/a.png');
    expect(toAssetUrl('http://example.com/a.png', VAULT)).toBe('http://example.com/a.png');
  });

  it('data: URL은 그대로 둔다', () => {
    const data = 'data:image/png;base64,AAAA';
    expect(toAssetUrl(data, VAULT)).toBe(data);
  });

  it('프로토콜-상대(//) URL은 그대로 둔다', () => {
    expect(toAssetUrl('//cdn.example.com/a.png', VAULT)).toBe('//cdn.example.com/a.png');
  });

  it('vaultPath가 없으면 원본 src를 그대로 반환한다', () => {
    expect(toAssetUrl('Assets/cat.png', null)).toBe('Assets/cat.png');
    expect(toAssetUrl('Assets/cat.png', undefined)).toBe('Assets/cat.png');
  });

  it('빈 src는 그대로 반환한다', () => {
    expect(toAssetUrl('', VAULT)).toBe('');
  });

  it('한글 파일명이 포함된 상대경로도 결합해 인코딩한다', () => {
    const url = toAssetUrl('Assets/회의 자료.png', VAULT);
    expect(url).toBe(
      `${ASSET_PROTOCOL}://asset/${encodeURIComponent('/Users/me/vault/Assets/회의 자료.png')}`,
    );
  });

  it('이미 percent-encoding된 src(react-markdown 출력)를 이중 인코딩하지 않는다', () => {
    // react-markdown은 한글 파일명을 %EC%96%B4... 형태로 인코딩해 넘긴다.
    const encoded = 'Assets/' + encodeURIComponent('어서오고.jpeg');
    expect(toAssetUrl(encoded, VAULT)).toBe(toAssetUrl('Assets/어서오고.jpeg', VAULT));
    // %25(이중 인코딩 흔적)가 결과에 없어야 한다.
    expect(toAssetUrl(encoded, VAULT)).not.toContain('%25');
  });

  it('공백이 %20으로 인코딩된 src도 원본 경로로 복원해 인코딩한다', () => {
    expect(toAssetUrl('Assets/my%20photo.png', VAULT)).toBe(
      toAssetUrl('Assets/my photo.png', VAULT),
    );
  });

  it('.. 경로 탈출이 포함되면 빈 문자열을 반환해 로드를 막는다', () => {
    expect(toAssetUrl('../../secret.png', VAULT)).toBe('');
    expect(toAssetUrl('Assets/../../secret.png', VAULT)).toBe('');
    expect(toAssetUrl('..\\..\\secret.png', VAULT)).toBe('');
  });
});
