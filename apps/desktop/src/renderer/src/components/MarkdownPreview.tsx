import { useCallback } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toAssetUrl } from '../utils/asset-url';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  // vault 루트. 로컬 이미지(Assets/…) src를 rememo-asset:// URL로 변환하는 데 쓴다.
  vaultPath?: string | null;
}

function MarkdownPreview({ content, vaultPath }: MarkdownPreviewProps) {
  // react-markdown 기본 새니타이즈(defaultUrlTransform)를 반드시 먼저 적용해 javascript:/data:
  // 같은 위험 스킴을 제거한다. 그 위에서 이미지 src(key === 'src')만 vault 로컬 URL로 변환한다.
  // (기본 변환기가 rememo-asset:// 직접 주입도 걸러내므로 악성 노트가 임의 경로를 지정할 수 없다.)
  const urlTransform = useCallback(
    (url: string, key: string) => {
      const safe = defaultUrlTransform(url);
      return key === 'src' ? toAssetUrl(safe, vaultPath) : safe;
    },
    [vaultPath],
  );

  return (
    <div className="markdown-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownPreview;
