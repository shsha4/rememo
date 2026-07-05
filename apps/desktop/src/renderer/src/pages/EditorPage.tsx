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

function EditorPage() {
  const { currentNote, setCurrentNote } = useNoteStore();
  const { currentVault } = useVaultStore();
  const [content, setContent] = useState(currentNote?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');

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
        { content }
      );
      setCurrentNote(updatedNote);
    } catch (error: any) {
      console.error('Failed to save note:', error);
      alert(error.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
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
                      title="Edit Mode"
                    >
                      Edit
                    </button>
                    <button
                      className={`mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                      onClick={() => setViewMode('split')}
                      title="Split View"
                    >
                      Split
                    </button>
                    <button
                      className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
                      onClick={() => setViewMode('preview')}
                      title="Preview Mode"
                    >
                      Preview
                    </button>
                  </div>
                  <button
                    className="btn-save"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
                  </button>
                </div>
              </div>
              <div className="editor-content">
                {renderEditor()}
              </div>
            </>
          ) : (
            <div className="editor-empty">
              <p>Select a note or create a new one</p>
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
                Properties
              </button>
              <button
                className={`panel-tab ${rightPanelTab === 'backlinks' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('backlinks')}
              >
                Backlinks
              </button>
            </div>
          </div>
          <div className="panel-content">
            {rightPanelTab === 'properties' ? (
              currentNote ? (
                <div className="note-metadata">
                  <p>
                    <strong>Created:</strong>{' '}
                    {new Date(currentNote.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Updated:</strong>{' '}
                    {new Date(currentNote.updatedAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>Path:</strong> {currentNote.path}
                  </p>
                </div>
              ) : (
                <p className="empty-message">No note selected</p>
              )
            ) : (
              currentNote ? (
                <Backlinks notePath={currentNote.path} />
              ) : (
                <p className="empty-message">No note selected</p>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditorPage;
