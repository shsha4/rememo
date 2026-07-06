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
  // 가장 최근에 선택 요청한 노트 경로. 연속 클릭 시 이전 요청의 응답을 무시하기 위해 사용.
  const latestSelectRef = useRef<string | null>(null);
  // 방향키 연타를 디바운스하기 위한 타이머와, 연타 중 누적되는 목표 인덱스.
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIndexRef = useRef<number | null>(null);

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

  // 방향키 위/아래로 노트 목록을 이동한다(활성 노트 기준, 끝에서 순환).
  // 입력창·에디터에 포커스가 있을 땐 가로채지 않는다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (notes.length === 0) return;

      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable ||
          el.closest('.cm-editor'))
      ) {
        return; // 편집 중에는 방향키 본래 동작을 유지
      }

      e.preventDefault();
      const lastIndex = notes.length - 1;
      // 연타 중에는 직전에 눌러 누적된 목표 인덱스(pendingIndexRef)를 기준으로 계산한다.
      // (currentNote는 디바운스 때문에 아직 갱신 전이라 기준으로 쓰면 한 칸씩만 움직인다.)
      const base = pendingIndexRef.current ?? (currentNote ? notes.indexOf(currentNote.path) : -1);
      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = base < 0 ? 0 : (base + 1) % notes.length;
      } else {
        nextIndex = base <= 0 ? lastIndex : base - 1;
      }
      pendingIndexRef.current = nextIndex;

      // 연타는 IPC 읽기를 매번 쏘지 않고, 멈춘 뒤 마지막 목표만 한 번 연다.
      // 이렇게 해야 뒤이은 마우스 클릭의 읽기가 방향키 읽기 뒤에 밀리지 않는다.
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        pendingIndexRef.current = null;
        handleSelectNote(notes[nextIndex]);
      }, 70);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
    // notes/currentNote/currentVault 변경 시 재구독되어 onKeyDown이 최신 값을 캡처한다.
  }, [notes, currentNote, currentVault]);

  const loadNotes = async () => {
    if (!currentVault) return;

    try {
      const noteList = await electronAPI.note.list({ vaultPath: currentVault.path });
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
        input: {
          vaultId: currentVault.id,
          title: newNoteName.trim(),
          path: notePath,
          content: `# ${newNoteName.trim()}\n\n`,
        },
        vaultPath: currentVault.path,
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

    latestSelectRef.current = notePath;
    try {
      const note = await electronAPI.note.read({ notePath, vaultId: currentVault.id });
      // 연속 클릭 시 이전 요청의 응답이 나중에 도착해 방금 고른 노트를 덮어쓰지 않도록,
      // 가장 최근 요청과 일치하는 응답만 반영한다.
      if (latestSelectRef.current !== notePath) return;
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
      await electronAPI.note.rename({
        oldPath,
        newPath,
        vaultPath: currentVault.path,
        vaultId: currentVault.id,
      });

      // Update current note if it was the one being renamed
      if (currentNote?.path === oldPath) {
        const renamedNote = await electronAPI.note.read({
          notePath: newPath,
          vaultId: currentVault.id,
        });
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
                <li key={notePath} className={currentNote?.path === notePath ? 'active' : ''}>
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
                        onMouseDown={(e) => {
                          if (e.button !== 0) return; // 좌클릭만
                          // 대기 중인 방향키 이동을 취소하고 즉시 이 노트를 연다.
                          if (navTimerRef.current) {
                            clearTimeout(navTimerRef.current);
                            navTimerRef.current = null;
                          }
                          pendingIndexRef.current = null;
                          handleSelectNote(notePath);
                        }}
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
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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
