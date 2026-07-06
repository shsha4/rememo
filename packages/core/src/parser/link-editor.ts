// WikiLink 편집(추가/삭제)을 위한 순수 함수 모음.
// 마크다운 문자열을 입력받아 변형된 문자열을 반환하며, 파일시스템/DB에 의존하지 않는다.
// 그래프 UI에서 노드 간 관계를 드래그로 추가/삭제할 때 이 함수들로 노트 본문을 변형한다.

// [[link]], [[link|alias]], [[link#heading]] 형태를 매칭한다(markdown-parser의 규칙과 동일).
const WIKI_LINK_TOKEN = /\[\[([^\]]+?)\]\]/g;

// 그래프 UI에서 관계를 추가할 때 링크를 모아두는 전용 섹션 제목(기본값).
export const RELATED_NOTES_HEADING = '관련 노트';

// WikiLink 내부 텍스트에서 실제 대상 노트 제목만 뽑는다(alias/heading 제거).
function linkTarget(inner: string): string {
  return inner.split('|')[0].split('#')[0].trim();
}

// content 안에 targetTitle을 가리키는 WikiLink가 이미 존재하는지 검사한다.
export function hasWikiLink(content: string, targetTitle: string): boolean {
  const target = targetTitle.trim();
  if (!target) return false;

  const regex = new RegExp(WIKI_LINK_TOKEN);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (linkTarget(match[1]) === target) {
      return true;
    }
  }
  return false;
}

/**
 * content에 targetTitle로의 WikiLink를 추가한다.
 * - 이미 같은 대상의 링크가 있으면 변경 없이 그대로 반환한다(멱등).
 * - `## 관련 노트` 전용 섹션이 있으면 그 섹션 끝에 `- [[대상]]` 리스트 항목을 추가한다.
 * - 없으면 문서 끝에 전용 섹션을 새로 만들고 항목을 추가한다.
 */
export function addWikiLink(
  content: string,
  targetTitle: string,
  sectionHeading: string = RELATED_NOTES_HEADING,
): string {
  const target = targetTitle.trim();
  if (!target || hasWikiLink(content, target)) {
    return content;
  }

  const item = `- [[${target}]]`;
  const headingLine = `## ${sectionHeading}`;
  const lines = content.split('\n');
  const headingIdx = lines.findIndex((line) => line.trim() === headingLine);

  // 전용 섹션이 없으면 문서 끝에 새로 만든다.
  if (headingIdx === -1) {
    const trimmed = content.replace(/\s+$/, '');
    const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : '';
    return `${prefix}${headingLine}\n\n${item}\n`;
  }

  // 섹션 끝(다음 heading 또는 문서 끝)을 찾는다.
  let endIdx = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  // 섹션 내 마지막 비어있지 않은 줄 다음에 삽입한다.
  let insertAt = headingIdx + 1;
  for (let i = headingIdx + 1; i < endIdx; i++) {
    if (lines[i].trim() !== '') {
      insertAt = i + 1;
    }
  }

  lines.splice(insertAt, 0, item);
  return lines.join('\n');
}

// 전용 섹션이 내용 없이 비었으면 heading과 주변 빈 줄을 제거한다.
function removeEmptySection(lines: string[], headingLine: string): string[] {
  const idx = lines.findIndex((line) => line.trim() === headingLine);
  if (idx === -1) return lines;

  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const hasContent = lines.slice(idx + 1, end).some((line) => line.trim() !== '');
  if (hasContent) return lines;

  // 섹션 앞의 빈 줄 하나까지 함께 정리한다.
  let start = idx;
  if (start > 0 && lines[start - 1].trim() === '') {
    start -= 1;
  }
  return [...lines.slice(0, start), ...lines.slice(end)];
}

/**
 * content에서 targetTitle을 가리키는 모든 WikiLink를 제거한다.
 * - alias/heading이 붙은 링크(`[[대상|별칭]]`, `[[대상#소제목]]`)도 대상이 같으면 제거한다.
 * - 링크 제거로 비게 된 리스트 항목 줄(`- ` 만 남는 줄)은 줄째 삭제한다.
 * - 전용 `## 관련 노트` 섹션이 완전히 비면 섹션 heading도 제거한다.
 */
export function removeWikiLink(
  content: string,
  targetTitle: string,
  sectionHeading: string = RELATED_NOTES_HEADING,
): string {
  const target = targetTitle.trim();
  if (!target) return content;

  const replaced = content.replace(new RegExp(WIKI_LINK_TOKEN), (full, inner) =>
    linkTarget(inner) === target ? '' : full,
  );

  // 링크만 있던 리스트 항목이 빈 마커(`- `, `* `, `1. ` 등)만 남으면 줄을 삭제한다.
  let lines = replaced.split('\n').filter((line) => !/^\s*(?:[-*+]|\d+\.)\s*$/.test(line));

  // 전용 섹션이 비었으면 heading까지 정리한다.
  lines = removeEmptySection(lines, `## ${sectionHeading}`);

  return lines.join('\n');
}
