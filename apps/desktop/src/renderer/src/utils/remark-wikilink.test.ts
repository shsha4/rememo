import { describe, it, expect } from 'vitest';
import {
  remarkWikiLink,
  encodeWikiLinkTarget,
  decodeWikiLinkTarget,
  WIKILINK_SCHEME,
} from './remark-wikilink';

// 테스트용 최소 mdast 노드 형태.
interface MdTestNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdTestNode[];
}

// 테스트 편의를 위한 최소 mdast 노드 팩토리.
function text(value: string): MdTestNode {
  return { type: 'text', value };
}
function paragraph(...children: MdTestNode[]): MdTestNode {
  return { type: 'paragraph', children };
}
function root(...children: MdTestNode[]): MdTestNode {
  return { type: 'root', children };
}

// 트리를 제자리 변형하고 첫 문단의 children을 돌려준다.
function transformParagraph(value: string): MdTestNode[] {
  const tree = root(paragraph(text(value)));
  remarkWikiLink()(tree as never);
  return tree.children![0].children!;
}

describe('encode/decodeWikiLinkTarget', () => {
  it('공백/한글/#이 있어도 왕복 복원된다', () => {
    for (const target of ['카프카', '프로젝트 A', 'a/b', '제목#헤딩', '김철수|별칭']) {
      expect(decodeWikiLinkTarget(encodeWikiLinkTarget(target))).toBe(target);
    }
  });

  it('wikilink: 스킴이 아니면 null', () => {
    expect(decodeWikiLinkTarget('https://example.com')).toBeNull();
    expect(decodeWikiLinkTarget('note.md')).toBeNull();
  });

  it('인코딩 결과는 wikilink: 스킴으로 시작한다', () => {
    expect(encodeWikiLinkTarget('카프카').startsWith(WIKILINK_SCHEME)).toBe(true);
  });
});

describe('remarkWikiLink', () => {
  it('단순 [[A]]를 링크 노드로 바꾼다', () => {
    const out = transformParagraph('[[카프카]]');
    expect(out).toEqual([
      {
        type: 'link',
        url: encodeWikiLinkTarget('카프카'),
        title: null,
        children: [text('카프카')],
      },
    ]);
  });

  it('별칭 [[A|별칭]]은 별칭을 표시하되 URL은 대상(A)을 가리킨다', () => {
    const out = transformParagraph('[[카프카|메시지큐]]');
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe(encodeWikiLinkTarget('카프카'));
    expect(out[0].children).toEqual([text('메시지큐')]);
  });

  it('헤딩 [[A#섹션]]은 표시엔 헤딩을 살리고 URL은 노트(A)만 가리킨다', () => {
    const out = transformParagraph('[[프로젝트#일정]]');
    expect(out[0].url).toBe(encodeWikiLinkTarget('프로젝트'));
    expect(out[0].children).toEqual([text('프로젝트#일정')]);
  });

  it('한글 조사가 뒤에 붙어도 링크와 나머지 텍스트를 분리한다', () => {
    const out = transformParagraph('[[카프카]]를 참고');
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('link');
    expect(out[0].url).toBe(encodeWikiLinkTarget('카프카'));
    expect(out[1]).toEqual(text('를 참고'));
  });

  it('한 줄에 여러 링크 + 앞뒤/사이 텍스트를 모두 보존한다', () => {
    const out = transformParagraph('앞 [[A]] 중간 [[B]] 뒤');
    expect(out.map((n) => (n.type === 'link' ? `L:${n.children![0].value}` : n.value))).toEqual([
      '앞 ',
      'L:A',
      ' 중간 ',
      'L:B',
      ' 뒤',
    ]);
  });

  it('위키링크가 없으면 텍스트 노드를 그대로 둔다', () => {
    const out = transformParagraph('그냥 평범한 문장입니다');
    expect(out).toEqual([text('그냥 평범한 문장입니다')]);
  });

  it('코드블록/인라인코드(value만 있고 text 타입이 아님)는 변환하지 않는다', () => {
    const tree = root(
      { type: 'code', value: '[[코드안의링크]]' },
      paragraph({ type: 'inlineCode', value: '[[인라인]]' }),
    );
    remarkWikiLink()(tree as never);
    expect(tree.children![0].value).toBe('[[코드안의링크]]');
    expect(tree.children![1].children).toEqual([{ type: 'inlineCode', value: '[[인라인]]' }]);
  });

  it('강조(emphasis) 같은 중첩 노드 안의 위키링크도 변환한다', () => {
    const tree = root({ type: 'emphasis', children: [text('[[중첩]]')] } as MdTestNode);
    remarkWikiLink()(tree as never);
    expect(tree.children![0].children).toEqual([
      {
        type: 'link',
        url: encodeWikiLinkTarget('중첩'),
        title: null,
        children: [text('중첩')],
      },
    ]);
  });
});
