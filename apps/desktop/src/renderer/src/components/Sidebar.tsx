import { useState, useEffect, useRef } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import { useResizable } from '../hooks/useResizable';
import './Sidebar.css';

function Sidebar() {
  const { currentVault } = useVaultStore();
  const { notes, setNotes, setCurrentNote, currentNote, triggerGraphRefresh } = useNoteStore();
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [editingNotePath, setEditingNotePath] = useState<string | null>(null);
  const [editingNoteName, setEditingNoteName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus input when creating/editing note
  useEffect(() => {
    if ((isCreatingNote || editingNotePath) && inputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCreatingNote, editingNotePath]);

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

  const handleRenameNote = async (oldPath: string) => {
    if (!currentVault || !editingNoteName.trim()) return;

    try {
      const notesDir = currentVault.config.defaultNoteLocation || 'Notes';
      const newPath = `${currentVault.path}/${notesDir}/${editingNoteName.trim()}.md`;

      // Check if renaming to same name
      if (oldPath === newPath) {
        setEditingNotePath(null);
        setEditingNoteName('');
        return;
      }

      // Rename the file
      await electronAPI.note.rename(oldPath, newPath, currentVault.path, currentVault.id);

      // Update current note if it was the one being renamed
      if (currentNote?.path === oldPath) {
        const renamedNote = await electronAPI.note.read(newPath, currentVault.id);
        setCurrentNote(renamedNote);
      }

      setEditingNotePath(null);
      setEditingNoteName('');
      await loadNotes();
      // Trigger graph refresh to update entity mentions
      triggerGraphRefresh();
    } catch (error: any) {
      console.error('Failed to rename note:', error);
      alert(error.message || 'Failed to rename note');
    }
  };

  const handleDoubleClickNote = (notePath: string) => {
    setEditingNotePath(notePath);
    setEditingNoteName(getDisplayName(notePath));
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
            ref={inputRef}
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
                >
                  {editingNotePath === notePath ? (
                    <div className="edit-note-form">
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingNoteName}
                        onChange={(e) => setEditingNoteName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameNote(notePath);
                          if (e.key === 'Escape') {
                            setEditingNotePath(null);
                            setEditingNoteName('');
                          }
                        }}
                        onBlur={() => {
                          setEditingNotePath(null);
                          setEditingNoteName('');
                        }}
                      />
                    </div>
                  ) : (
                    <div className="note-item-wrapper">
                      <span
                        className="note-name"
                        onClick={() => handleSelectNote(notePath)}
                      >
                        {getDisplayName(notePath)}
                      </span>
                      <button
                        className="btn-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDoubleClickNote(notePath);
                        }}
                        title="Rename note"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  )}
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
