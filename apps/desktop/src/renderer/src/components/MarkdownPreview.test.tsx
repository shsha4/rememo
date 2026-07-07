import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MarkdownPreview from './MarkdownPreview';
import { encodeWikiLinkTarget } from '../utils/remark-wikilink';

// 실제 렌더 파이프라인(remark-wikilink 플러그인 + urlTransform + a 컴포넌트)을 그대로 태워
// 위키링크가 "클릭 가능한 링크"로, 해결/미해결이 올바른 클래스·href로 렌더되는지 검증한다.
function render(props: Parameters<typeof MarkdownPreview>[0]): string {
  return renderToStaticMarkup(createElement(MarkdownPreview, props));
}

describe('MarkdownPreview 위키링크 렌더', () => {
  it('해결된 [[노트]]는 wikilink 링크(액센트)로, href는 wikilink: 스킴으로 렌더한다', () => {
    const html = render({
      content: '[[카프카]] 참고',
      wikiLinkResolution: new Map([['카프카', { notePath: '/v/카프카.md', exists: true }]]),
      onWikiLinkClick: () => {},
    });
    expect(html).toContain(`href="${encodeWikiLinkTarget('카프카')}"`);
    expect(html).toContain('class="wikilink"');
    expect(html).not.toContain('is-unresolved');
    expect(html).toContain('카프카');
  });

  it('미해결(exists=false) [[노트]]는 is-unresolved 클래스로 흐릿하게 렌더한다', () => {
    const html = render({
      content: '[[없는노트]]',
      wikiLinkResolution: new Map([['없는노트', { notePath: '/v/없는노트.md', exists: false }]]),
      onWikiLinkClick: () => {},
    });
    expect(html).toContain('class="wikilink is-unresolved"');
  });

  it('별칭 [[대상|별칭]]은 별칭을 표시하고 href는 대상을 가리킨다', () => {
    const html = render({
      content: '[[카프카|메시지큐]]',
      onWikiLinkClick: () => {},
    });
    expect(html).toContain(`href="${encodeWikiLinkTarget('카프카')}"`);
    expect(html).toContain('메시지큐');
    expect(html).not.toContain('>카프카<');
  });

  it('코드블록 안의 [[..]]는 링크로 만들지 않고 원문 그대로 둔다', () => {
    const html = render({
      content: '```\n[[코드안]]\n```',
      onWikiLinkClick: () => {},
    });
    expect(html).toContain('[[코드안]]');
    // 코드블록 내용은 wikilink 앵커로 감싸이지 않는다.
    expect(html).not.toContain(`href="${encodeWikiLinkTarget('코드안')}"`);
  });

  it('외부 링크는 일반 앵커로 렌더한다(위키링크 클래스 없음, http 보존)', () => {
    const html = render({
      content: '[구글](https://google.com)',
      onWikiLinkClick: () => {},
    });
    expect(html).toContain('href="https://google.com"');
    expect(html).not.toContain('wikilink');
  });

  it('onWikiLinkClick이 없어도 위키링크 렌더는 깨지지 않는다', () => {
    const run = () => render({ content: '[[무엇이든]]' });
    expect(run).not.toThrow();
    expect(run()).toContain('class="wikilink"');
  });
});

// 클릭 시 대상 target이 그대로 콜백으로 전달됨을 보장하는 스모크: 인코딩→디코딩 왕복이
// a 컴포넌트의 onClick 경로와 동일하게 동작하는지(디코딩 결과가 원문 target인지) 확인.
describe('위키링크 클릭 대상 전달', () => {
  it('href의 wikilink: 스킴은 원래 target으로 복원된다(onClick이 넘기는 값)', async () => {
    const { decodeWikiLinkTarget } = await import('../utils/remark-wikilink');
    const spy = vi.fn();
    spy(decodeWikiLinkTarget(encodeWikiLinkTarget('프로젝트 A')));
    expect(spy).toHaveBeenCalledWith('프로젝트 A');
  });
});
