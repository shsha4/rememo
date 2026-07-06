import { describe, it, expect } from 'vitest';
import { addWikiLink, removeWikiLink, hasWikiLink, RELATED_NOTES_HEADING } from './link-editor';

describe('hasWikiLink', () => {
  it('대상 링크가 있으면 true', () => {
    expect(hasWikiLink('본문 [[김철수]] 끝', '김철수')).toBe(true);
  });

  it('alias/heading이 붙어도 대상이 같으면 true', () => {
    expect(hasWikiLink('[[김철수|철수]]', '김철수')).toBe(true);
    expect(hasWikiLink('[[프로젝트A#일정]]', '프로젝트A')).toBe(true);
  });

  it('대상이 다르면 false', () => {
    expect(hasWikiLink('[[이영희]]', '김철수')).toBe(false);
  });

  it('빈 대상은 false', () => {
    expect(hasWikiLink('[[김철수]]', '   ')).toBe(false);
  });
});

describe('addWikiLink', () => {
  it('전용 섹션이 없으면 문서 끝에 섹션을 만들고 링크를 추가한다', () => {
    const result = addWikiLink('첫 줄 내용', '김철수');
    expect(result).toBe(`첫 줄 내용\n\n## ${RELATED_NOTES_HEADING}\n\n- [[김철수]]\n`);
  });

  it('빈 문서에도 섹션을 만든다', () => {
    const result = addWikiLink('', '김철수');
    expect(result).toBe(`## ${RELATED_NOTES_HEADING}\n\n- [[김철수]]\n`);
  });

  it('전용 섹션이 이미 있으면 그 섹션 끝에 항목을 추가한다', () => {
    const content = `본문\n\n## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]\n`;
    const result = addWikiLink(content, '김철수');
    expect(result).toBe(`본문\n\n## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]\n- [[김철수]]\n`);
  });

  it('이미 같은 대상 링크가 있으면 변경 없이 그대로 반환한다(멱등)', () => {
    const content = `본문 [[김철수]] 참고`;
    expect(addWikiLink(content, '김철수')).toBe(content);
  });

  it('본문 다른 곳에 링크가 있으면 섹션에 중복 추가하지 않는다', () => {
    const content = `[[김철수]]와 회의\n\n## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]`;
    expect(addWikiLink(content, '김철수')).toBe(content);
  });

  it('공백 대상은 무시한다', () => {
    expect(addWikiLink('본문', '   ')).toBe('본문');
  });

  it('전용 섹션 뒤에 다른 섹션이 있으면 그 사이(섹션 끝)에 삽입한다', () => {
    const content = `## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]\n\n## 메모\n\n딴 내용`;
    const result = addWikiLink(content, '김철수');
    expect(result).toBe(
      `## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]\n- [[김철수]]\n\n## 메모\n\n딴 내용`,
    );
  });
});

describe('removeWikiLink', () => {
  it('전용 섹션의 리스트 항목을 제거하고, 섹션이 비면 heading까지 제거한다', () => {
    const content = `본문\n\n## ${RELATED_NOTES_HEADING}\n\n- [[김철수]]\n`;
    const result = removeWikiLink(content, '김철수');
    expect(result).toBe('본문');
  });

  it('섹션에 다른 링크가 남으면 heading은 유지한다', () => {
    const content = `## ${RELATED_NOTES_HEADING}\n\n- [[김철수]]\n- [[이영희]]`;
    const result = removeWikiLink(content, '김철수');
    expect(result).toBe(`## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]`);
  });

  it('alias/heading이 붙은 링크도 대상이 같으면 제거한다', () => {
    const content = `## ${RELATED_NOTES_HEADING}\n\n- [[김철수|철수]]`;
    expect(removeWikiLink(content, '김철수')).toBe('');
  });

  it('순서 리스트 항목이 링크 제거로 비면 줄째 삭제한다', () => {
    const content = `## ${RELATED_NOTES_HEADING}\n\n1. [[김철수]]\n2. [[이영희]]`;
    const result = removeWikiLink(content, '김철수');
    expect(result).toBe(`## ${RELATED_NOTES_HEADING}\n\n2. [[이영희]]`);
  });

  it('본문 산문 속 링크 토큰만 제거한다(리스트 항목이 아닌 경우 줄은 유지)', () => {
    const content = '회의는 [[김철수]] 담당';
    expect(removeWikiLink(content, '김철수')).toBe('회의는  담당');
  });

  it('대상이 없으면 변경 없이 반환한다', () => {
    const content = `## ${RELATED_NOTES_HEADING}\n\n- [[이영희]]`;
    expect(removeWikiLink(content, '김철수')).toBe(content);
  });

  it('공백 대상은 무시한다', () => {
    const content = '[[김철수]]';
    expect(removeWikiLink(content, '  ')).toBe(content);
  });
});
