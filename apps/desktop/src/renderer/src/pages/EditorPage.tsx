import { useState, useEffect, useCallback } from 'react';
import { MarkdownParser } from '@memograph/core';
import Sidebar from '../components/Sidebar';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownPreview from '../components/MarkdownPreview';
import type { WikiLinkResolution } from '../components/MarkdownPreview';
import Backlinks from '../components/Backlinks';
import { useNoteStore } from '../stores/note.store';
import { useVaultStore } from '../stores/vault.store';
import { electronAPI } from '../api/electron-api';
import './EditorPage.css';

// [[...]] 문법 파싱용 단일 파서(모듈 레벨: 렌더마다 재생성 안 함).
const parser = new MarkdownParser();

// 본문에서 유니크한 위키링크 대상(target)들을 뽑는다(헤딩/별칭 제외한 노트 제목·경로).
function uniqueWikiLinkTargets(content: string): string[] {
  const targets = parser.parseWikiLinks(content).map((l) => l.target);
  return [...new Set(targets)];
}

type ViewMode = 'edit' | 'preview' | 'split';
type RightPanelTab = 'properties' | 'backlinks';

interface EditorPageProps {
  onNoteDeleted?: () => void;
}

function EditorPage({ onNoteDeleted }: EditorPageProps) {
  const {
    currentNote,
    setCurrentNote,
    setNotes,
    triggerGraphRefresh,
    setDirtyNotePath,
    externalChangePath,
  } = useNoteStore();
  const { currentVault } = useVaultStore();
  const [content, setContent] = useState(currentNote?.content || '');
  const [loadedHash, setLoadedHash] = useState<string | undefined>(currentNote?.contentHash);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');
  // 프리뷰 위키링크 해석 결과: target → {notePath, exists}. 미해결 링크를 흐릿하게 표시하는 데 쓴다.
  const [wikiLinkResolution, setWikiLinkResolution] = useState<Map<string, WikiLinkResolution>>(
    new Map(),
  );

  // 노트가 바뀌거나(경로) 같은 노트라도 내용(contentHash)이 바뀌면 렌더 중 즉시 content를 교체한다.
  // - contentHash 기준이라 다른 탭(할 일 등)에서 파일이 수정돼 스토어가 갱신되면 에디터에도 실시간 반영된다.
  // - 편집 중에는 스토어의 currentNote가 안 바뀌므로(저장 시에만 갱신) 타이핑 내용이 덮이지 않는다.
  // - useEffect로 미루지 않고 렌더 중 동기화해 "두 번 클릭해야 반영"되는 지연을 없앤다.
  if (currentNote?.contentHash !== loadedHash) {
    setLoadedHash(currentNote?.contentHash);
    setContent(currentNote?.content || '');
  }

  // 미저장 편집 여부를 스토어에 반영한다(외부 변경 push가 왔을 때 열린 노트를 덮어쓸지 판단용, 안전 모드).
  // content가 저장된 원본(currentNote.content)과 다르면 dirty로 표시한다.
  useEffect(() => {
    const dirty = !!currentNote && content !== currentNote.content;
    setDirtyNotePath(dirty ? currentNote!.path : null);
  }, [content, currentNote, setDirtyNotePath]);

  // 외부에서 이 노트가 변경됐고 미저장 편집 때문에 자동 반영을 보류한 상태인지.
  const hasExternalChange = !!currentNote && externalChangePath === currentNote.path;

  // 외부 변경을 사용자가 수동으로 반영(미저장 편집은 버려짐).
  const handleReloadExternal = async () => {
    if (!currentNote || !currentVault) return;
    try {
      const fresh = await electronAPI.note.read({
        notePath: currentNote.path,
        vaultId: currentVault.id,
      });
      // setCurrentNote가 dirty/externalChange 상태를 함께 초기화한다.
      setCurrentNote(fresh);
    } catch (error) {
      console.error('Failed to reload externally changed note:', error);
      alert(error instanceof Error ? error.message : '외부 변경 내용을 불러오지 못했습니다');
    }
  };

  // 노트가 바뀌면 이전 노트 기준 해석 맵을 즉시 버린다(해석은 출발 노트 경로에 의존하므로,
  // 디바운스 재해석 전까지 스테일 표시가 남지 않게). 클릭 동작은 어차피 즉석 재해석한다.
  useEffect(() => {
    setWikiLinkResolution(new Map());
  }, [currentNote?.path]);

  // 프리뷰가 보일 때만, 본문의 위키링크 대상들을 해석해 해결/미해결을 판정한다(150ms 디바운스).
  // content(미저장 편집 포함)를 기준으로 해석하므로 방금 입력한 [[X]]도 즉시 반영된다.
  useEffect(() => {
    if (viewMode === 'edit' || !currentNote || !currentVault) {
      return;
    }
    const targets = uniqueWikiLinkTargets(content);
    if (targets.length === 0) {
      setWikiLinkResolution(new Map());
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await Promise.all(
          targets.map(async (target) => {
            try {
              const res = await electronAPI.link.resolve({
                vaultPath: currentVault.path,
                notePath: currentNote.path,
                target,
              });
              return [target, res] as const;
            } catch {
              // vault 밖(../) 등 해석 불가 링크는 맵에서 제외한다. 다른 링크 해석까지 막지 않도록
              // 개별 격리하고, 클릭 시 재해석에서 에러가 표면화된다.
              return null;
            }
          }),
        );
        if (!cancelled) {
          const entries = results.filter(
            (r): r is readonly [string, WikiLinkResolution] => r !== null,
          );
          setWikiLinkResolution(new Map(entries));
        }
      } catch (error) {
        console.error('Failed to resolve wiki links:', error);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, currentNote, currentVault, viewMode]);

  // 프리뷰에서 위키링크 클릭: 해결되면 그 노트를 열고, 미해결이면 확인 후 생성하고 연다.
  const handleWikiLinkClick = useCallback(
    async (target: string) => {
      if (!currentNote || !currentVault) return;

      // 미저장 편집이 있으면 이동 시 사라지므로 먼저 확인한다(외부 변경 안전 모드와 동일한 취지).
      if (content !== currentNote.content) {
        const proceed = confirm('저장하지 않은 편집이 있습니다. 이동하면 사라집니다. 계속할까요?');
        if (!proceed) return;
      }

      try {
        // 해석은 출발 노트 경로에 의존하므로 캐시(스테일 가능)를 신뢰하지 않고 항상 즉석 해석한다.
        // (캐시 wikiLinkResolution은 표시 스타일 전용.)
        const res = await electronAPI.link.resolve({
          vaultPath: currentVault.path,
          notePath: currentNote.path,
          target,
        });

        if (res.exists) {
          const note = await electronAPI.note.read({
            notePath: res.notePath,
            vaultId: currentVault.id,
          });
          setCurrentNote(note);
          return;
        }

        const confirmed = confirm(`"${target}" 노트가 없습니다. 새로 만들까요?`);
        if (!confirmed) return;

        // 파일명(제목)은 경로 구분자를 제외한 마지막 조각으로 한다([[폴더/노트]] 대응).
        const title = target.split(/[\\/]/).pop() || target;
        const created = await electronAPI.note.create({
          input: {
            vaultId: currentVault.id,
            title,
            path: res.notePath,
            content: `# ${title}\n\n`,
          },
          vaultPath: currentVault.path,
        });
        setCurrentNote(created);
        // 앱 자기 생성이라 watcher push가 억제되므로(markInternalChange), 사이드바 목록/그래프를
        // 직접 갱신해 새 노트가 즉시 보이게 한다.
        try {
          const list = await electronAPI.note.list({ vaultPath: currentVault.path });
          setNotes(list);
        } catch (listError) {
          console.error('Failed to reload note list after wiki link create:', listError);
        }
        triggerGraphRefresh();
      } catch (error) {
        console.error('Failed to open/create wiki link target:', error);
        alert(error instanceof Error ? error.message : '링크 대상 노트를 열지 못했습니다');
      }
    },
    [content, currentNote, currentVault, setCurrentNote, setNotes, triggerGraphRefresh],
  );

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  const handleSave = async () => {
    if (!currentNote || !currentVault) return;

    setIsSaving(true);
    try {
      const updatedNote = await electronAPI.note.update({
        notePath: currentNote.path,
        vaultId: currentVault.id,
        update: { content },
        vaultPath: currentVault.path,
      });
      setCurrentNote(updatedNote);
      // Trigger graph refresh to update entity mentions
      triggerGraphRefresh();
    } catch (error: any) {
      console.error('Failed to save note:', error);
      alert(error.message || '메모 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentNote || !currentVault) return;

    const confirmed = confirm(
      `"${currentNote.title}" 메모를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    try {
      await electronAPI.note.delete({ notePath: currentNote.path, vaultPath: currentVault.path });
      setCurrentNote(null);
      // onNoteDeleted가 appKey를 올려 EditorPage(내부 Sidebar 포함)를 통째로 리마운트하므로
      // 별도의 sidebarKey로 Sidebar만 다시 마운트할 필요가 없다(이중 리마운트 제거).
      onNoteDeleted?.();
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      alert(error.message || '메모 삭제에 실패했습니다');
    }
  };

  const renderEditor = () => {
    switch (viewMode) {
      case 'edit':
        return (
          <MarkdownEditor
            value={content}
            onChange={handleContentChange}
            onSave={handleSave}
            vaultPath={currentVault?.path}
          />
        );
      case 'preview':
        return (
          <MarkdownPreview
            content={content}
            vaultPath={currentVault?.path}
            wikiLinkResolution={wikiLinkResolution}
            onWikiLinkClick={handleWikiLinkClick}
          />
        );
      case 'split':
        return (
          <div className="split-view">
            <div className="split-pane">
              <MarkdownEditor
                value={content}
                onChange={handleContentChange}
                onSave={handleSave}
                vaultPath={currentVault?.path}
              />
            </div>
            <div className="split-divider" />
            <div className="split-pane">
              <MarkdownPreview
                content={content}
                vaultPath={currentVault?.path}
                wikiLinkResolution={wikiLinkResolution}
                onWikiLinkClick={handleWikiLinkClick}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="editor-page">
      <div className="editor-layout">
        <Sidebar />

        <main className="editor-main">
          {currentNote ? (
            <>
              <div className="editor-header">
                <h3>{currentNote.title}</h3>
                <div className="editor-actions">
                  <div className="view-mode-switcher">
                    <button
                      className={`mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
                      onClick={() => setViewMode('edit')}
                      title="편집 모드"
                    >
                      편집
                    </button>
                    <button
                      className={`mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                      onClick={() => setViewMode('split')}
                      title="분할 보기"
                    >
                      분할
                    </button>
                    <button
                      className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
                      onClick={() => setViewMode('preview')}
                      title="미리보기 모드"
                    >
                      미리보기
                    </button>
                  </div>
                  <button className="btn-delete" onClick={handleDelete} title="메모 삭제">
                    삭제
                  </button>
                  <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? '저장 중...' : '저장 (Ctrl+S)'}
                  </button>
                </div>
              </div>
              {hasExternalChange && (
                <div className="external-change-banner">
                  <span>
                    이 노트가 외부에서 변경되었습니다. 미저장 편집이 있어 자동 반영을 보류했어요.
                  </span>
                  <button className="btn-sm btn-primary" onClick={handleReloadExternal}>
                    새로고침(외부 내용 불러오기)
                  </button>
                </div>
              )}
              {/* content를 렌더 중 즉시 동기화(위)하므로 에디터를 remount하지 않아도
                  노트 전환 시 내용이 바로 갱신된다. remount는 전환 지연의 원인이라 제거. */}
              <div className="editor-content">{renderEditor()}</div>
            </>
          ) : (
            <div className="editor-empty">
              <p>메모를 선택하거나 새로 만들어주세요</p>
            </div>
          )}
        </main>

        <aside className="right-panel">
          <div className="panel-header">
            <div className="panel-tabs">
              <button
                className={`panel-tab ${rightPanelTab === 'properties' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('properties')}
              >
                속성
              </button>
              <button
                className={`panel-tab ${rightPanelTab === 'backlinks' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('backlinks')}
              >
                역링크
              </button>
            </div>
          </div>
          <div className="panel-content">
            {rightPanelTab === 'properties' ? (
              currentNote ? (
                <div className="note-metadata">
                  <p>
                    <strong>생성:</strong> {new Date(currentNote.createdAt).toLocaleString('ko-KR')}
                  </p>
                  <p>
                    <strong>수정:</strong> {new Date(currentNote.updatedAt).toLocaleString('ko-KR')}
                  </p>
                  <p>
                    <strong>경로:</strong> {currentNote.path}
                  </p>
                </div>
              ) : (
                <p className="empty-message">메모가 선택되지 않았습니다</p>
              )
            ) : currentNote ? (
              <Backlinks notePath={currentNote.path} />
            ) : (
              <p className="empty-message">메모가 선택되지 않았습니다</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditorPage;
