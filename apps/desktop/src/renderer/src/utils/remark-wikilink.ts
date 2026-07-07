import { MarkdownParser } from '@memograph/core';

// 프리뷰에서 [[노트]] 위키링크를 클릭 가능한 링크로 만들기 위한 remark(mdast) 변환.
// - text 노드만 쪼개므로 코드블록(`code`)·인라인코드(`inlineCode`)는 자동으로 제외된다.
// - 문법 파싱은 core MarkdownParser.parseWikiLinks를 재사용한다([[...]] 문법의 단일 소스).
// - 링크 URL은 내부 전용 스킴 wikilink:<encoded target>. MarkdownPreview가 이 스킴을 가로채
//   앱 안에서 노트를 열고, 외부로는 절대 네비게이트하지 않는다(하얀 화면 방지).

export const WIKILINK_SCHEME = 'wikilink:';

// mdast 노드의 최소 형태(우리가 다루는 필드만). @types/mdast 의존을 피하려고 로컬 정의.
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
}

const parser = new MarkdownParser();

/** [[target]] 대상 텍스트를 wikilink: URL로 인코딩한다(공백/한글/# 안전). */
export function encodeWikiLinkTarget(target: string): string {
  return WIKILINK_SCHEME + encodeURIComponent(target);
}

/** wikilink: URL이면 대상 텍스트를 복원한다. 아니면 null. */
export function decodeWikiLinkTarget(url: string): string | null {
  if (!url.startsWith(WIKILINK_SCHEME)) {
    return null;
  }
  try {
    return decodeURIComponent(url.slice(WIKILINK_SCHEME.length));
  } catch {
    return url.slice(WIKILINK_SCHEME.length);
  }
}

// 하나의 text 노드를 [텍스트, 링크, 텍스트, ...]로 쪼갠다. 위키링크가 없으면 null.
function splitTextNode(node: MdNode): MdNode[] | null {
  const value = node.value ?? '';
  const links = parser.parseWikiLinks(value).filter((l) => l.position);
  if (links.length === 0) {
    return null;
  }

  const out: MdNode[] = [];
  let cursor = 0;
  for (const link of links) {
    const { start, end } = link.position!;
    if (start > cursor) {
      out.push({ type: 'text', value: value.slice(cursor, start) });
    }
    // 표시 텍스트: 별칭 우선, 없으면 헤딩까지 살려 노트#헤딩로 보여준다.
    const display = link.alias ?? (link.heading ? `${link.target}#${link.heading}` : link.target);
    out.push({
      type: 'link',
      url: encodeWikiLinkTarget(link.target),
      title: null,
      children: [{ type: 'text', value: display }],
    });
    cursor = end;
  }
  if (cursor < value.length) {
    out.push({ type: 'text', value: value.slice(cursor) });
  }
  return out;
}

function transform(node: MdNode): void {
  if (!node.children) {
    return;
  }
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      const split = splitTextNode(child);
      if (split) {
        next.push(...split);
      } else {
        next.push(child);
      }
    } else {
      // link/code/inlineCode 등은 내부를 재귀 처리하되(중첩 강조 안의 위키링크 지원) 노드 자체는 유지.
      // code/inlineCode는 children이 없으므로 transform이 즉시 반환 → 코드 내용은 건드리지 않는다.
      transform(child);
      next.push(child);
    }
  }
  node.children = next;
}

// react-markdown remarkPlugins에 넣을 플러그인. tree를 제자리 변형한다.
export function remarkWikiLink() {
  return (tree: MdNode): void => transform(tree);
}
