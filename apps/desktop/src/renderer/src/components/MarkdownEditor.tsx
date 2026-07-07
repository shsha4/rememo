import { useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { electronAPI } from '../api/electron-api';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  // 이미지 저장 위치(vault 루트). 없으면 이미지 붙여넣기/드롭이 비활성화된다.
  vaultPath?: string | null;
}

/** DataTransfer(클립보드/드래그)에서 이미지 File만 추린다. */
function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files).filter((file) => file.type.startsWith('image/'));
}

function MarkdownEditor({ value, onChange, onSave, vaultPath }: MarkdownEditorProps) {
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        onSave?.();
      }
    },
    [onSave],
  );

  // 이미지들을 순차 저장하고 각각 커서 위치에 마크다운으로 삽입한다.
  const insertImages = useCallback(
    async (view: EditorView, files: File[], origin: 'paste' | 'drop') => {
      if (!vaultPath) return;
      for (const file of files) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          // 드롭은 원본 파일명을 유지하고, 붙여넣기는 Pasted-image 규칙을 쓴다.
          const originalName = origin === 'drop' ? file.name || undefined : undefined;
          const relativePath = await electronAPI.asset.saveImage({
            vaultPath,
            data: bytes,
            mime: file.type,
            originalName,
          });
          // 저장(비동기) 사이에 노트가 바뀌어 에디터가 언마운트됐으면 다른 노트를
          // 오염시키지 않도록 삽입을 건너뛴다. 이미지 파일 자체는 이미 저장돼 있다.
          if (!view.dom.isConnected) return;
          view.dispatch(view.state.replaceSelection(`![](${relativePath})`));
        } catch (error) {
          console.error('Failed to insert image:', error);
          alert(error instanceof Error ? error.message : '이미지 삽입에 실패했습니다');
        }
      }
    },
    [vaultPath],
  );

  // CodeMirror DOM 이벤트 핸들러 확장. vaultPath가 바뀌면 재생성된다.
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      // 긴 한 줄이 오른쪽에서 잘려 보이지 않도록 자동 줄바꿈한다.
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        paste(event, view) {
          if (!vaultPath) return false;
          const files = imageFilesFromDataTransfer(event.clipboardData);
          if (files.length === 0) return false;
          event.preventDefault();
          void insertImages(view, files, 'paste');
          return true;
        },
        drop(event, view) {
          // 파일 드롭은 이미지가 아니어도 기본 동작(창이 file://로 네비게이션되어 편집
          // 내용이 유실)을 막는다.
          const droppedFiles = event.dataTransfer?.files;
          if (!droppedFiles || droppedFiles.length === 0) return false;
          event.preventDefault();

          if (!vaultPath) return true;
          const images = imageFilesFromDataTransfer(event.dataTransfer);
          if (images.length === 0) return true;
          void insertImages(view, images, 'drop');
          return true;
        },
      }),
    ],
    [vaultPath, insertImages],
  );

  return (
    <div className="markdown-editor-wrapper">
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={extensions}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
}

export default MarkdownEditor;
