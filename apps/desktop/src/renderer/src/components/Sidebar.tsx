import { useState, useEffect } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import './Sidebar.css';

function Sidebar() {
  const { currentVault } = useVaultStore();
  const { notes, setNotes, setCurrentNote, currentNote } = useNoteStore();
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');

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
      });

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
      alert(error.message || 'Failed to read note');
    }
  };

  const getRelativeNotePath = (notePath: string): string => {
    if (!currentVault) return notePath;
    const vaultPath = currentVault.path.replace(/\\/g, '/');
    const normalizedPath = notePath.replace(/\\/g, '/');
    return normalizedPath.replace(vaultPath + '/', '');
  };

  if (!currentVault) {
    return null;
  }

  return (
    <aside className="sidebar">
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
                  {getRelativeNotePath(notePath)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
