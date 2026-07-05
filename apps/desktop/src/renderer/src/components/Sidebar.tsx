import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import { useResizable } from '../hooks/useResizable';
import './Sidebar.css';

function Sidebar() {
  const { currentVault } = useVaultStore();
  const { notes, setNotes, setCurrentNote, currentNote } = useNoteStore();
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');

  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: 280,
    minWidth: 200,
    maxWidth: 500,
    storageKey: 'sidebar-width',
  });

  useEffect(() => {
    if (currentVault) {
      loadNotes();
    }
  }, [currentVault]);

  const loadNotes = async () => {
    if (!currentVault) return;

    try {
      const noteList = await electronAPI.note.list(currentVault.path);
      setNotes(noteList);
    } catch (error: any) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleCreateNote = async () => {
    if (!currentVault || !newNoteName.trim()) return;

    try {
      const notesDir = currentVault.config.defaultNoteLocation || 'Notes';
      const notePath = `${currentVault.path}/${notesDir}/${newNoteName.trim()}.md`;

      const note = await electronAPI.note.create({
        vaultId: currentVault.id,
        title: newNoteName.trim(),
        path: notePath,
        content: `# ${newNoteName.trim()}\n\n`,
      }, currentVault.path);

      setCurrentNote(note);
      setNewNoteName('');
      setIsCreatingNote(false);
      await loadNotes();
    } catch (error: any) {
      console.error('Failed to create note:', error);
      alert(error.message || 'Failed to create note');
    }
  };

  const handleSelectNote = async (notePath: string) => {
    if (!currentVault) return;

    try {
      const note = await electronAPI.note.read(notePath, currentVault.id);
      setCurrentNote(note);
    } catch (error: any) {
      console.error('Failed to read note:', error);

      // If note not found, refresh the note list
      if (error.message?.includes('not found') || error.message?.includes('NoteNotFoundError')) {
        alert('메모를 찾을 수 없습니다. 목록을 새로고침합니다.');
        await loadNotes();
      } else {
        alert(error.message || '메모를 읽는데 실패했습니다');
      }
    }
  };

  const getDisplayName = (notePath: string): string => {
    if (!currentVault) return notePath;

    // Get relative path from vault root
    const vaultPath = currentVault.path.replace(/\\/g, '/');
    const normalizedPath = notePath.replace(/\\/g, '/');
    const relativePath = normalizedPath.replace(vaultPath + '/', '');

    // Remove .md extension
    const withoutExtension = relativePath.replace(/\.md$/, '');

    // Remove Notes/ prefix if it exists
    const notesDir = currentVault.config.defaultNoteLocation || 'Notes';
    return withoutExtension.replace(new RegExp(`^${notesDir}/`), '');
  };

  if (!currentVault) {
    return null;
  }

  return (
    <aside className="sidebar" style={{ width: `${width}px` }}>
      <div className="sidebar-header">
        <h3>{currentVault.name}</h3>
        <button className="btn-icon" onClick={() => setIsCreatingNote(true)} title="New Note">
          +
        </button>
      </div>

      {isCreatingNote && (
        <div className="create-note-form">
          <input
            type="text"
            placeholder="Note name"
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNote();
              if (e.key === 'Escape') {
                setIsCreatingNote(false);
                setNewNoteName('');
              }
            }}
            autoFocus
          />
          <div className="form-actions-inline">
            <button className="btn-sm btn-primary" onClick={handleCreateNote}>
              Create
            </button>
            <button
              className="btn-sm btn-secondary"
              onClick={() => {
                setIsCreatingNote(false);
                setNewNoteName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-content">
        <div className="notes-section">
          <h4>Notes ({notes.length})</h4>
          {notes.length === 0 ? (
            <p className="empty-message">No notes yet. Create one!</p>
          ) : (
            <ul className="notes-list">
              {notes.map((notePath) => (
                <li
                  key={notePath}
                  className={currentNote?.path === notePath ? 'active' : ''}
                  onClick={() => handleSelectNote(notePath)}
                >
                  {getDisplayName(notePath)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}

export default Sidebar;
