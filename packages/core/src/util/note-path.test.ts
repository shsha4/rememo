import { describe, it, expect } from 'vitest';
import { normalizeNotePath } from './note-path';

describe('normalizeNotePath', () => {
  it('역슬래시를 슬래시로 바꾼다', () => {
    expect(normalizeNotePath('C:\\Users\\me\\memo\\Notes\\a.md')).toBe(
      'C:/Users/me/memo/Notes/a.md',
    );
  });

  it('슬래시/역슬래시가 섞인 경로를 하나로 통일한다', () => {
    expect(normalizeNotePath('C:\\Users\\me\\memo/Notes/a.md')).toBe('C:/Users/me/memo/Notes/a.md');
  });

  it('이미 슬래시면 그대로 둔다', () => {
    expect(normalizeNotePath('C:/Users/me/memo/Notes/a.md')).toBe('C:/Users/me/memo/Notes/a.md');
  });

  it('같은 파일의 두 표기가 같은 문자열로 정규화된다', () => {
    const a = normalizeNotePath('C:\\x\\memo\\Notes\\할일.md');
    const b = normalizeNotePath('C:\\x\\memo/Notes/할일.md');
    expect(a).toBe(b);
  });
});
