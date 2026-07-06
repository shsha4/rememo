import { WikiLink, LinkPosition } from '../domain/link';
import { Tag, TagPosition } from '../domain/tag';
import { NoteMetadata } from '../domain/note';
import { Todo, TodoPosition } from '../domain/todo';

export interface ParseResult {
  wikiLinks: WikiLink[];
  tags: Tag[];
  metadata?: NoteMetadata;
}

export class MarkdownParser {
  // WikiLink patterns: [[link]], [[link|alias]], [[link#heading]]
  private static WIKI_LINK_REGEX = /\[\[([^\]]+?)\]\]/g;

  // Tag pattern: #tag or #nested/tag
  private static TAG_REGEX = /#([\w가-힣]+(?:\/[\w가-힣]+)*)/g;

  // YAML Front Matter pattern
  private static YAML_FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---/;

  // Checkbox task line: 선행 공백 + 불릿(-,*,+) + [ ]/[x]/[X] + 텍스트
  private static TODO_LINE_REGEX = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/;

  // 마감일 문법 두 가지 (둘 다 지원): 📅 YYYY-MM-DD [HH:mm] / @due(YYYY-MM-DD [HH:mm])
  private static DUE_EMOJI_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/;
  private static DUE_AT_REGEX = /@due\(\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?\s*\)/;

  // 코드펜스 경계 (``` 또는 ~~~). 펜스 내부의 체크박스는 할 일로 보지 않는다.
  private static CODE_FENCE_REGEX = /^(\s*)(`{3,}|~{3,})/;

  // Entity mention interface
  parseEntityMentions(
    content: string,
    entityTitles: string[],
    currentNoteTitle?: string,
  ): WikiLink[] {
    const mentions: WikiLink[] = [];

    // Filter out the current note's title to avoid self-references
    const filteredTitles = currentNoteTitle
      ? entityTitles.filter((title) => title !== currentNoteTitle)
      : entityTitles;

    // Remove YAML front matter and existing WikiLinks to avoid false matches
    const contentWithoutFrontMatter = this.extractContentWithoutFrontMatter(content);
    const wikiLinkRanges = this.getWikiLinkRanges(content);

    // Sort entity titles by length (longest first) to match longer phrases first
    const sortedTitles = [...filteredTitles].sort((a, b) => b.length - a.length);

    for (const title of sortedTitles) {
      if (title.length < 2) continue; // Skip very short titles

      // Escape special regex characters
      const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match whole words only (using word boundaries for English, context for Korean/mixed)
      // 엔티티 이름 뒤에 한국어 조사(선택)가 붙을 수 있고, 그 뒤는 단어 경계여야 한다.
      // 조사는 여러 글자(에서/으로/에게…)를 먼저 매칭하도록 긴 것부터 나열한다.
      // 조사가 없으면 곧바로 비-단어 경계(공백/문장부호/줄끝)여야 한다.
      // 이렇게 해야 "박민준과"(조사 과), "은혁진은"(조사 은)은 인식하고 "카프카방"(합성어)은 제외한다.
      const JOSA =
        '으로|에서|에게|한테|부터|까지|처럼|보다|마다|은|는|이|가|을|를|과|와|의|에|도|만|로';
      const regex = new RegExp(`(?<![\\w가-힣])${escapedTitle}(?:${JOSA})?(?![\\w가-힣])`, 'g');

      let match: RegExpExecArray | null;
      while ((match = regex.exec(contentWithoutFrontMatter)) !== null) {
        const position: LinkPosition = {
          start: match.index,
          end: match.index + match[0].length,
          line: this.getLineNumber(contentWithoutFrontMatter, match.index),
        };

        // Skip if this position is already inside a WikiLink
        const isInsideWikiLink = wikiLinkRanges.some(
          (range) => match!.index >= range.start && match!.index < range.end,
        );

        if (!isInsideWikiLink) {
          mentions.push({
            target: title,
            position,
          });
        }
      }
    }

    return mentions;
  }

  // Helper to get all WikiLink ranges in content
  private getWikiLinkRanges(content: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const regex = new RegExp(MarkdownParser.WIKI_LINK_REGEX);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return ranges;
  }

  parse(content: string): ParseResult {
    const wikiLinks = this.parseWikiLinks(content);
    const tags = this.parseTags(content);
    const metadata = this.parseYAMLFrontMatter(content);

    return {
      wikiLinks,
      tags,
      metadata,
    };
  }

  parseWikiLinks(content: string): WikiLink[] {
    const links: WikiLink[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(MarkdownParser.WIKI_LINK_REGEX);

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const innerText = match[1];

      const position: LinkPosition = {
        start: match.index,
        end: match.index + fullMatch.length,
        line: this.getLineNumber(content, match.index),
      };

      // Parse [[link|alias]] or [[link#heading]]
      if (innerText.includes('|')) {
        const [target, alias] = innerText.split('|').map((s) => s.trim());

        if (target.includes('#')) {
          const [noteTitle, heading] = target.split('#').map((s) => s.trim());
          links.push({
            target: noteTitle,
            alias,
            heading,
            position,
          });
        } else {
          links.push({
            target,
            alias,
            position,
          });
        }
      } else if (innerText.includes('#')) {
        const [target, heading] = innerText.split('#').map((s) => s.trim());
        links.push({
          target,
          heading,
          position,
        });
      } else {
        links.push({
          target: innerText.trim(),
          position,
        });
      }
    }

    return links;
  }

  parseTags(content: string): Tag[] {
    const tags: Tag[] = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(MarkdownParser.TAG_REGEX);

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const tag = match[1];

      const position: TagPosition = {
        start: match.index,
        end: match.index + fullMatch.length,
        line: this.getLineNumber(content, match.index),
      };

      tags.push({
        id: '', // Will be set by the service
        noteId: '', // Will be set by the service
        tag,
        position,
      });
    }

    return tags;
  }

  /**
   * 체크박스(`- [ ]`)를 할 일로 인식해 목록으로 반환한다.
   * 코드펜스(``` / ~~~) 내부의 체크박스는 제외한다.
   * 마감일 토큰(📅 / @due(...))이 있으면 dueDate로 분리하고 텍스트에서 제거한다.
   */
  parseTodos(content: string): Todo[] {
    const todos: Todo[] = [];
    const lines = content.split('\n');

    let offset = 0;
    let inCodeFence = false;
    let fenceMarker = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = offset;
      // 다음 줄 오프셋(+1은 split으로 사라진 '\n')
      offset += line.length + 1;

      // 코드펜스 진입/이탈 처리
      const fenceMatch = line.match(MarkdownParser.CODE_FENCE_REGEX);
      if (fenceMatch) {
        const marker = fenceMatch[2][0]; // '`' 또는 '~'
        if (!inCodeFence) {
          inCodeFence = true;
          fenceMarker = marker;
        } else if (marker === fenceMarker) {
          inCodeFence = false;
          fenceMarker = '';
        }
        continue;
      }
      if (inCodeFence) {
        continue;
      }

      const match = line.match(MarkdownParser.TODO_LINE_REGEX);
      if (!match) {
        continue;
      }

      const completed = match[2].toLowerCase() === 'x';
      const rawText = match[3];
      const { dueDate, hasTime, cleanText } = this.extractDueDate(rawText);

      // 마감일 토큰만 있고 실제 텍스트가 비면 할 일로 보지 않는다.
      if (cleanText.length === 0) {
        continue;
      }

      const position: TodoPosition = {
        start: lineStart,
        end: lineStart + line.length,
        line: i + 1,
      };

      todos.push({
        text: cleanText,
        completed,
        dueDate,
        hasTime,
        notePath: '',
        line: i + 1,
        position,
      });
    }

    return todos;
  }

  /**
   * 텍스트에서 마감일 토큰(📅 / @due(...))을 추출한다.
   * 유효하지 않은 날짜(예: 2026-13-40)는 마감일로 취급하지 않고 토큰도 남긴다.
   */
  private extractDueDate(text: string): { dueDate?: string; hasTime: boolean; cleanText: string } {
    // 두 문법(📅 / @due())을 모두 찾아 등장 순서대로 정렬하고,
    // 처음으로 "유효한 날짜"를 가진 토큰을 채택한다.
    // (앞선 토큰이 무효 날짜여도 뒤의 유효한 토큰을 버리지 않는다.)
    const candidates: RegExpMatchArray[] = [];
    const emoji = text.match(MarkdownParser.DUE_EMOJI_REGEX);
    const at = text.match(MarkdownParser.DUE_AT_REGEX);
    if (emoji) candidates.push(emoji);
    if (at) candidates.push(at);
    candidates.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const match = candidates.find((m) => this.isValidCalendarDate(m[1]));
    if (!match) {
      return { hasTime: false, cleanText: text.trim() };
    }

    const date = match[1];
    // 시각은 범위(00:00~23:59)가 유효할 때만 사용하고, 아니면 날짜만 쓴다.
    const time = this.isValidTime(match[2]) ? match[2] : undefined;
    const dueDate = time ? `${date}T${time}` : date;
    const cleanText = text
      .replace(match[0], '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return { dueDate, hasTime: Boolean(time), cleanText };
  }

  /** HH:mm 문자열의 시(0~23)·분(0~59) 범위를 검사한다. undefined(시각 없음)는 유효로 본다. */
  private isValidTime(timeStr?: string): boolean {
    if (!timeStr) return true;
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }

  /** `YYYY-MM-DD` 문자열이 실제 달력상 유효한 날짜인지 검사한다. */
  private isValidCalendarDate(dateStr: string): boolean {
    const parts = dateStr.split('-').map(Number);
    const [year, month, day] = parts;
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  parseYAMLFrontMatter(content: string): NoteMetadata | undefined {
    const match = content.match(MarkdownParser.YAML_FRONT_MATTER_REGEX);
    if (!match) {
      return undefined;
    }

    const yamlContent = match[1];
    const metadata: NoteMetadata = {};

    // Simple YAML parser (only handles basic key: value pairs)
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      // Handle arrays (e.g., tags: [tag1, tag2])
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.substring(1, value.length - 1);
        metadata[key] = arrayContent
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      } else {
        metadata[key] = value;
      }
    }

    return metadata;
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return beforeIndex.split('\n').length;
  }

  extractContentWithoutFrontMatter(content: string): string {
    const match = content.match(MarkdownParser.YAML_FRONT_MATTER_REGEX);
    if (!match) {
      return content;
    }

    return content.substring(match[0].length).trim();
  }
}

export const markdownParser = new MarkdownParser();

// 지정한 줄(1-based)의 체크박스 상태를 토글한 새 content를 반환한다.
// 대상 줄이 체크박스가 아니거나 범위를 벗어나면 원본을 그대로 반환한다.
// 줄 끝의 '\r'(CRLF)은 보존된다.
const CHECKBOX_TOGGLE_REGEX = /^(\s*[-*+]\s+\[)([ xX])(\])/;

export function toggleTodoLine(content: string, line: number): string {
  const lines = content.split('\n');
  const index = line - 1;
  if (index < 0 || index >= lines.length) {
    return content;
  }

  const match = lines[index].match(CHECKBOX_TOGGLE_REGEX);
  if (!match) {
    return content;
  }

  const next = match[2] === ' ' ? 'x' : ' ';
  lines[index] = lines[index].replace(CHECKBOX_TOGGLE_REGEX, `$1${next}$3`);

  return lines.join('\n');
}

// 한 줄에 있는 기존 마감일 토큰(📅 ... / @due(...))을 모두 찾는다.
const DUE_TOKEN_REGEX = /\s*(?:📅\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?|@due\([^)]*\))/g;

/**
 * 지정한 줄(1-based)의 체크박스 할 일에 마감일을 설정/변경/삭제한 새 content를 반환한다.
 * - dueDate가 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm'이면 `📅 ...` 형태로 넣는다(기존 토큰은 교체).
 * - dueDate가 null이면 기존 마감일 토큰을 제거한다.
 * 대상 줄이 체크박스가 아니거나 범위를 벗어나면 원본을 그대로 반환한다. 줄 끝의 '\r'은 보존한다.
 */
export function setDueDateOnLine(content: string, line: number, dueDate: string | null): string {
  const lines = content.split('\n');
  const index = line - 1;
  if (index < 0 || index >= lines.length) {
    return content;
  }

  const raw = lines[index];
  const hasCR = raw.endsWith('\r');
  const body = hasCR ? raw.slice(0, -1) : raw;

  if (!CHECKBOX_TOGGLE_REGEX.test(body)) {
    return content;
  }

  // 기존 마감일 토큰 제거 + 뒤쪽 공백 정리
  let updated = body.replace(DUE_TOKEN_REGEX, '').replace(/[ \t]+$/, '');

  if (dueDate) {
    const [date, time] = dueDate.split('T');
    updated += time ? ` 📅 ${date} ${time}` : ` 📅 ${date}`;
  }

  lines[index] = hasCR ? `${updated}\r` : updated;
  return lines.join('\n');
}
