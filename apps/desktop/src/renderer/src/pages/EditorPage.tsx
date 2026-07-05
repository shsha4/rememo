import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownPreview from '../components/MarkdownPreview';
import Backlinks from '../components/Backlinks';
import { useNoteStore } from '../stores/note.store';
import { useVaultStore } from '../stores/vault.store';
import { electronAPI } from '../api/electron-api';
import './EditorPage.css';

type ViewMode = 'edit' | 'preview' | 'split';
type RightPanelTab = 'properties' | 'backlinks';

interface EditorPageProps {
  onNoteDeleted?: () => void;
}

function EditorPage({ onNoteDeleted }: EditorPageProps) {
  const { currentNote, setCurrentNote } = useNoteStore();
  const { currentVault } = useVaultStore();
  const [content, setContent] = useState(currentNote?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');
  const [sidebarKey, setSidebarKey] = useState(0);

  // Update content when note changes
  useEffect(() => {
    setContent(currentNote?.content || '');
  }, [currentNote]);

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  const handleSave = async () => {
    if (!currentNote || !currentVault) return;

    setIsSaving(true);
    try {
      const updatedNote = await electronAPI.note.update(
        currentNote.path,
        currentVault.id,
        { content },
        currentVault.path
      );
      setCurrentNote(updatedNote);
    } catch (error: any) {
      console.error('Failed to save note:', error);
      alert(error.message || '메모 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentNote || !currentVault) return;

    const confirmed = confirm(`"${currentNote.title}" 메모를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    try {
      await electronAPI.note.delete(currentNote.path, currentVault.path);
      setCurrentNote(null);
      setSidebarKey(prev => prev + 1); // Force Sidebar to reload
      onNoteDeleted?.();
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      alert(error.message || '메모 삭제에 실패했습니다');
    }
  };

  const renderEditor = () => {
    switch (viewMode) {
      case 'edit':
        return <MarkdownEditor value={content} onChange={handleContentChange} onSave={handleSave} />;
      case 'preview':
        return <MarkdownPreview content={content} />;
      case 'split':
        return (
          <div className="split-view">
            <div className="split-pane">
              <MarkdownEditor value={content} onChange={handleContentChange} onSave={handleSave} />
            </div>
            <div className="split-divider" />
            <div className="split-pane">
              <MarkdownPreview content={content} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="editor-page">
      <div className="editor-layout">
        <Sidebar key={`sidebar-${sidebarKey}`} />

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
                  <button
                    className="btn-delete"
                    onClick={handleDelete}
                    title="메모 삭제"
                  >
                    삭제
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '저장 (Ctrl+S)'}
                  </button>
                </div>
              </div>
              <div className="editor-content">
                {renderEditor()}
              </div>
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
                    <strong>생성:</strong>{' '}
                    {new Date(currentNote.createdAt).toLocaleString('ko-KR')}
                  </p>
                  <p>
                    <strong>수정:</strong>{' '}
                    {new Date(currentNote.updatedAt).toLocaleString('ko-KR')}
                  </p>
                  <p>
                    <strong>경로:</strong> {currentNote.path}
                  </p>
                </div>
              ) : (
                <p className="empty-message">메모가 선택되지 않았습니다</p>
              )
            ) : (
              currentNote ? (
                <Backlinks notePath={currentNote.path} />
              ) : (
                <p className="empty-message">메모가 선택되지 않았습니다</p>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditorPage;
