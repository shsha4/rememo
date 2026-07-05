import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNoteStore } from '../stores/note.store';
import { useVaultStore } from '../stores/vault.store';
import { electronAPI } from '../api/electron-api';
import './EditorPage.css';

function EditorPage() {
  const { currentNote, setCurrentNote } = useNoteStore();
  const { currentVault } = useVaultStore();
  const [content, setContent] = useState(currentNote?.content || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update content when note changes
  useEffect(() => {
    setContent(currentNote?.content || '');
  }, [currentNote]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
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
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
                </button>
              </div>
              <div className="editor-content">
                <textarea
                  className="markdown-editor"
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Start writing..."
                />
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
            <h3>Properties</h3>
          </div>
          <div className="panel-content">
            {currentNote ? (
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
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default EditorPage;
