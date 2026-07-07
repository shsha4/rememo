import { useCallback, useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toAssetUrl } from '../utils/asset-url';
import { remarkWikiLink, WIKILINK_SCHEME, decodeWikiLinkTarget } from '../utils/remark-wikilink';
import './MarkdownPreview.css';

export interface WikiLinkResolution {
  notePath: string;
  exists: boolean;
}

interface MarkdownPreviewProps {
  content: string;
  // vault 루트. 로컬 이미지(Assets/…) src를 rememo-asset:// URL로 변환하는 데 쓴다.
  vaultPath?: string | null;
  // 위키링크 해석 결과: target → {notePath, exists}. 미해결(exists=false)이면 흐릿/점선으로 표시한다.
  // 아직 로딩 전(맵에 없음)이면 일반 링크처럼 보여준다.
  wikiLinkResolution?: Map<string, WikiLinkResolution>;
  // 위키링크 클릭 시 대상 target을 전달한다. 없으면 위키링크는 클릭해도 아무 동작을 하지 않는다.
  onWikiLinkClick?: (target: string) => void;
}

// react-markdown이 커스텀 컴포넌트에 넘기는 앵커 props(필요한 필드만).
interface AnchorProps {
  href?: string;
  children?: React.ReactNode;
  title?: string;
  // react-markdown이 주입하는 mdast 노드 — DOM 속성이 아니므로 <a>로 전달하지 않는다.
  node?: unknown;
}

function MarkdownPreview({
  content,
  vaultPath,
  wikiLinkResolution,
  onWikiLinkClick,
}: MarkdownPreviewProps) {
  // react-markdown 기본 새니타이즈(defaultUrlTransform)를 반드시 먼저 적용해 javascript:/data:
  // 같은 위험 스킴을 제거한다. 그 위에서 이미지 src(key === 'src')만 vault 로컬 URL로 변환한다.
  // (기본 변환기가 rememo-asset:// 직접 주입도 걸러내므로 악성 노트가 임의 경로를 지정할 수 없다.)
  // 단, 내부 전용 wikilink: 스킴은 기본 변환기가 지워버리므로 그대로 통과시킨다(클릭은 우리가 가로채
  // 앱 안에서만 처리하고 창을 네비게이트하지 않으므로 안전하다).
  const urlTransform = useCallback(
    (url: string, key: string) => {
      if (url.startsWith(WIKILINK_SCHEME)) {
        return url;
      }
      const safe = defaultUrlTransform(url);
      return key === 'src' ? toAssetUrl(safe, vaultPath) : safe;
    },
    [vaultPath],
  );

  const components = useMemo(
    () => ({
      a: ({ href, children, title, node: _node, ...rest }: AnchorProps) => {
        const target = href ? decodeWikiLinkTarget(href) : null;
        if (target !== null) {
          // 해석 맵에 있고 미존재면 미해결(흐릿+점선). 아직 로딩 전이면 일반 위키링크처럼.
          const res = wikiLinkResolution?.get(target);
          const unresolved = res ? !res.exists : false;
          const className = unresolved ? 'wikilink is-unresolved' : 'wikilink';
          return (
            <a
              className={className}
              href={href}
              title={unresolved ? `${target} (없는 노트 — 클릭하면 새로 만듭니다)` : target}
              onClick={(event) => {
                event.preventDefault();
                onWikiLinkClick?.(target);
              }}
            >
              {children}
            </a>
          );
        }
        // 외부/일반 링크: 기본 렌더. 창 이동은 main 프로세스 네비게이션 가드가 막고
        // http(s)는 시스템 브라우저로 연다.
        return (
          <a href={href} title={title} {...rest}>
            {children}
          </a>
        );
      },
    }),
    [wikiLinkResolution, onWikiLinkClick],
  );

  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikiLink]}
        urlTransform={urlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownPreview;
