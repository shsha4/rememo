import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  buildNoteTree,
  getNoteCategoryPath,
  type TreeItem,
  type CategoryTreeItem,
  type NoteTreeItem,
} from '@memograph/core';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import { useResizable } from '../hooks/useResizable';
import './Sidebar.css';

// 새로 만들 항목(노트/카테고리)의 위치와 종류. parentPath는 노트 루트 기준 상대 카테고리 경로.
interface CreatingState {
  parentPath: string;
  kind: 'note' | 'category';
}

// preload가 던지는 Error는 name=error.code, message=사유. unknown에서 안전하게 뽑아 쓴다.
function errName(e: unknown): string {
  return e instanceof Error ? e.name : '';
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function Sidebar() {
  const { currentVault } = useVaultStore();
  const { notes, setNotes, setCurrentNote, currentNote, dirtyNotePath, triggerGraphRefresh } =
    useNoteStore();

  // 빈 카테고리까지 노출하기 위한 폴더 목록(전체 경로). notes와 함께 트리를 구성한다.
  const [folders, setFolders] = useState<string[]>([]);

  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [newName, setNewName] = useState('');
  const [editingNotePath, setEditingNotePath] = useState<string | null>(null);
  const [editingNoteName, setEditingNoteName] = useState('');
  const [editingCategoryPath, setEditingCategoryPath] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  // 접힌 카테고리 경로 집합(없으면 펼침). vault별로 localStorage에 영속한다.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 드래그로 노트를 올려둔 대상 카테고리 경로(하이라이트용). 루트는 '__ROOT__'.
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // 입력창이 DOM에 붙는 순간 포커스한다(콜백 ref는 마운트 시 정확히 한 번 호출).
  const focusOnMount = useCallback((el: HTMLInputElement | null) => {
    if (el) el.focus();
  }, []);
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

  const notesDir = currentVault?.config.defaultNoteLocation || 'Notes';
  const vaultPath = currentVault ? currentVault.path.replace(/\\/g, '/') : '';
  const collapseKey = currentVault ? `sidebar-collapsed:${currentVault.id}` : '';

  // 카테고리 상대경로 → 절대 폴더 경로.
  const categoryAbsPath = (relPath: string): string =>
    relPath ? `${vaultPath}/${notesDir}/${relPath}` : `${vaultPath}/${notesDir}`;
  // 카테고리 상대경로 + 파일명(확장자 포함) → 절대 노트 경로.
  const noteAbsPath = (categoryRel: string, fileName: string): string =>
    `${categoryAbsPath(categoryRel)}/${fileName}`;

  const tree = useMemo<TreeItem[]>(() => {
    if (!currentVault) return [];
    return buildNoteTree({ notePaths: notes, folderPaths: folders, vaultPath, notesDir });
  }, [currentVault, notes, folders, vaultPath, notesDir]);

  const loadNotes = useCallback(async () => {
    if (!currentVault) return;
    try {
      const noteList = await electronAPI.note.list({ vaultPath: currentVault.path });
      setNotes(noteList);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  }, [currentVault, setNotes]);

  const loadFolders = useCallback(async () => {
    if (!currentVault) return;
    try {
      const folderList = await electronAPI.category.list({
        vaultPath: currentVault.path,
        notesDir,
      });
      setFolders(folderList);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  }, [currentVault, notesDir]);

  useEffect(() => {
    if (currentVault) {
      loadNotes();
    }
  }, [currentVault, loadNotes]);

  // 폴더는 notes/vault가 바뀔 때마다 다시 계산한다(외부 변경 push로 notes가 갱신되는 경우도 커버).
  useEffect(() => {
    if (currentVault) {
      loadFolders();
    }
  }, [currentVault, notes, loadFolders]);

  // vault별 접힘 상태 로드.
  useEffect(() => {
    if (!collapseKey) return;
    try {
      const raw = localStorage.getItem(collapseKey);
      setCollapsed(new Set<string>(raw ? JSON.parse(raw) : []));
    } catch {
      setCollapsed(new Set());
    }
  }, [collapseKey]);

  const persistCollapsed = (next: Set<string>) => {
    if (!collapseKey) return;
    try {
      localStorage.setItem(collapseKey, JSON.stringify([...next]));
    } catch {
      // 무시(영속 실패해도 UI는 동작)
    }
  };

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      persistCollapsed(next);
      return next;
    });
  };

  // 방향키 위/아래로 노트 목록을 이동한다(활성 노트 기준, 끝에서 순환).
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
      const base = pendingIndexRef.current ?? (currentNote ? notes.indexOf(currentNote.path) : -1);
      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = base < 0 ? 0 : (base + 1) % notes.length;
      } else {
        nextIndex = base <= 0 ? lastIndex : base - 1;
      }
      pendingIndexRef.current = nextIndex;

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
  }, [notes, currentNote, currentVault]);

  const handleSelectNote = async (notePath: string) => {
    if (!currentVault) return;
    latestSelectRef.current = notePath;
    try {
      const note = await electronAPI.note.read({ notePath, vaultId: currentVault.id });
      if (latestSelectRef.current !== notePath) return;
      setCurrentNote(note);
    } catch (error) {
      console.error('Failed to read note:', error);
      const msg = errMessage(error);
      if (errName(error) === 'NoteNotFoundError' || msg.includes('not found')) {
        alert('메모를 찾을 수 없습니다. 목록을 새로고침합니다.');
        await loadNotes();
      } else {
        alert(msg || '메모를 읽는데 실패했습니다');
      }
    }
  };

  const startCreate = (kind: 'note' | 'category', parentPath: string) => {
    setCreating({ kind, parentPath });
    setNewName('');
    // 대상 카테고리를 펼쳐 입력창이 보이게 한다.
    if (parentPath) {
      setCollapsed((prev) => {
        if (!prev.has(parentPath)) return prev;
        const next = new Set(prev);
        next.delete(parentPath);
        persistCollapsed(next);
        return next;
      });
    }
  };

  const cancelCreate = () => {
    setCreating(null);
    setNewName('');
  };

  const handleCreateSubmit = async () => {
    if (!currentVault || !creating || !newName.trim()) return;
    const name = newName.trim();

    try {
      if (creating.kind === 'note') {
        const notePath = noteAbsPath(creating.parentPath, `${name}.md`);
        const note = await electronAPI.note.create({
          input: {
            vaultId: currentVault.id,
            title: name,
            path: notePath,
            content: `# ${name}\n\n`,
          },
          vaultPath: currentVault.path,
        });
        setCurrentNote(note);
      } else {
        const dirPath = creating.parentPath
          ? `${categoryAbsPath(creating.parentPath)}/${name}`
          : `${categoryAbsPath('')}/${name}`;
        await electronAPI.category.create({ dirPath });
      }
      cancelCreate();
      await loadNotes();
      await loadFolders();
    } catch (error) {
      console.error('Failed to create:', error);
      if (errName(error) === 'CategoryAlreadyExistsError') {
        alert('같은 이름의 카테고리가 이미 있습니다.');
      } else if (errName(error) === 'NoteAlreadyExistsError') {
        alert('같은 이름의 노트가 이미 있습니다.');
      } else {
        alert(errMessage(error) || '생성에 실패했습니다');
      }
    }
  };

  const startRenameNote = (note: NoteTreeItem) => {
    setEditingNotePath(note.path);
    setEditingNoteName(note.title);
  };

  const handleRenameNote = async (oldPath: string) => {
    if (!currentVault || !editingNoteName.trim()) return;
    const name = editingNoteName.trim();

    try {
      // 이름변경은 파일명만 바꾸고 현재 카테고리(폴더)는 유지한다.
      const dir = oldPath.slice(0, oldPath.lastIndexOf('/'));
      const newPath = `${dir}/${name}.md`;

      if (oldPath === newPath) {
        setEditingNotePath(null);
        setEditingNoteName('');
        return;
      }

      await electronAPI.note.rename({
        oldPath,
        newPath,
        vaultPath: currentVault.path,
        vaultId: currentVault.id,
      });

      if (currentNote?.path === oldPath) {
        const renamed = await electronAPI.note.read({
          notePath: newPath,
          vaultId: currentVault.id,
        });
        setCurrentNote(renamed);
      }

      setEditingNotePath(null);
      setEditingNoteName('');
      await loadNotes();
      await loadFolders();
      triggerGraphRefresh();
    } catch (error) {
      console.error('Failed to rename note:', error);
      alert(errMessage(error) || '노트 이름변경에 실패했습니다');
    }
  };

  const startRenameCategory = (cat: CategoryTreeItem) => {
    setEditingCategoryPath(cat.path);
    setEditingCategoryName(cat.name);
  };

  const handleRenameCategory = async (cat: CategoryTreeItem) => {
    if (!currentVault || !editingCategoryName.trim()) return;
    const name = editingCategoryName.trim();

    if (name === cat.name) {
      setEditingCategoryPath(null);
      setEditingCategoryName('');
      return;
    }

    const oldAbs = categoryAbsPath(cat.path);
    const parentRel = cat.path.includes('/') ? cat.path.slice(0, cat.path.lastIndexOf('/')) : '';
    const newAbs = parentRel
      ? `${categoryAbsPath(parentRel)}/${name}`
      : `${categoryAbsPath('')}/${name}`;

    // 열린 노트가 이 카테고리 하위에 있고 미저장 편집이 있으면 이동으로 인한 유실 위험이 있어 막는다.
    if (dirtyNotePath && dirtyNotePath.startsWith(oldAbs + '/')) {
      alert(
        '이 카테고리 안의 노트에 저장하지 않은 변경이 있어 이름을 바꿀 수 없습니다. 먼저 저장하세요.',
      );
      setEditingCategoryPath(null);
      setEditingCategoryName('');
      return;
    }

    try {
      await electronAPI.category.rename({
        oldPath: oldAbs,
        newPath: newAbs,
        vaultPath: currentVault.path,
        vaultId: currentVault.id,
      });

      // 열린 노트가 이동됐으면 새 경로로 다시 읽는다.
      if (currentNote && currentNote.path.startsWith(oldAbs + '/')) {
        const moved = newAbs + currentNote.path.slice(oldAbs.length);
        try {
          const fresh = await electronAPI.note.read({ notePath: moved, vaultId: currentVault.id });
          setCurrentNote(fresh);
        } catch {
          setCurrentNote(null);
        }
      }

      setEditingCategoryPath(null);
      setEditingCategoryName('');
      await loadNotes();
      await loadFolders();
      triggerGraphRefresh();
    } catch (error) {
      console.error('Failed to rename category:', error);
      if (errName(error) === 'CategoryAlreadyExistsError') {
        alert('같은 이름의 카테고리가 이미 있습니다.');
      } else {
        alert(errMessage(error) || '카테고리 이름변경에 실패했습니다');
      }
    }
  };

  const handleDeleteCategory = async (cat: CategoryTreeItem) => {
    if (!currentVault) return;
    if (!confirm(`카테고리 '${cat.name}'을(를) 삭제할까요? (비어 있어야 삭제됩니다)`)) return;

    try {
      await electronAPI.category.delete({
        dirPath: categoryAbsPath(cat.path),
        vaultPath: currentVault.path,
      });
      await loadNotes();
      await loadFolders();
    } catch (error) {
      console.error('Failed to delete category:', error);
      if (errName(error) === 'CategoryNotEmptyError') {
        alert('카테고리가 비어있지 않습니다. 먼저 안의 노트를 옮기거나 삭제하세요.');
      } else {
        alert(errMessage(error) || '카테고리 삭제에 실패했습니다');
      }
    }
  };

  // 드래그한 노트를 대상 카테고리(relPath)로 이동한다.
  const handleMoveNote = async (notePath: string, targetCategoryRel: string) => {
    if (!currentVault) return;

    const currentCategory = getNoteCategoryPath(notePath, vaultPath, notesDir);
    if (currentCategory === targetCategoryRel) return; // 이미 그 카테고리에 있음

    if (dirtyNotePath === notePath) {
      alert('저장하지 않은 변경이 있어 노트를 옮길 수 없습니다. 먼저 저장하세요.');
      return;
    }

    const fileName = notePath.slice(notePath.lastIndexOf('/') + 1);
    const newPath = noteAbsPath(targetCategoryRel, fileName);

    try {
      await electronAPI.note.rename({
        oldPath: notePath,
        newPath,
        vaultPath: currentVault.path,
        vaultId: currentVault.id,
      });

      if (currentNote?.path === notePath) {
        const moved = await electronAPI.note.read({ notePath: newPath, vaultId: currentVault.id });
        setCurrentNote(moved);
      }

      await loadNotes();
      await loadFolders();
      triggerGraphRefresh();
    } catch (error) {
      console.error('Failed to move note:', error);
      if (errName(error) === 'NoteAlreadyExistsError') {
        alert('대상 카테고리에 같은 이름의 노트가 이미 있습니다.');
      } else {
        alert(errMessage(error) || '노트 이동에 실패했습니다');
      }
    }
  };

  if (!currentVault) {
    return null;
  }

  const INDENT = 14;

  const renderCreateInput = (depth: number) => (
    <div className="tree-row create-inline" style={{ paddingLeft: `${depth * INDENT + 8}px` }}>
      <input
        ref={focusOnMount}
        type="text"
        placeholder={creating?.kind === 'category' ? '새 카테고리 이름' : '새 노트 이름'}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateSubmit();
          if (e.key === 'Escape') cancelCreate();
        }}
        onBlur={() => {
          // 빈 값으로 포커스가 빠지면 취소한다(빈 항목 생성 방지).
          if (!newName.trim()) cancelCreate();
        }}
      />
    </div>
  );

  const renderNote = (note: NoteTreeItem, depth: number) => {
    const isEditing = editingNotePath === note.path;
    return (
      <div
        key={note.path}
        className={`tree-row note-row ${currentNote?.path === note.path ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * INDENT + 8}px` }}
        draggable={!isEditing}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/note-path', note.path);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          if (isEditing) return;
          if (navTimerRef.current) {
            clearTimeout(navTimerRef.current);
            navTimerRef.current = null;
          }
          pendingIndexRef.current = null;
          handleSelectNote(note.path);
        }}
      >
        {isEditing ? (
          <div className="edit-note-form">
            <input
              ref={focusOnMount}
              type="text"
              value={editingNoteName}
              onChange={(e) => setEditingNoteName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameNote(note.path);
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
            <span className="note-name">{note.title}</span>
            <button
              className="btn-edit"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                startRenameNote(note);
              }}
              title="이름 변경"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
      </div>
    );
  };

  const renderCategory = (cat: CategoryTreeItem, depth: number) => {
    const isCollapsed = collapsed.has(cat.path);
    const isEditing = editingCategoryPath === cat.path;
    const isDragOver = dragOverPath === cat.path;

    return (
      <div key={`cat:${cat.path}`}>
        <div
          className={`tree-row category-row ${isDragOver ? 'drag-over' : ''}`}
          style={{ paddingLeft: `${depth * INDENT + 8}px` }}
          onClick={() => !isEditing && toggleCollapse(cat.path)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverPath(cat.path);
          }}
          onDragLeave={() => setDragOverPath((p) => (p === cat.path ? null : p))}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverPath(null);
            const notePath = e.dataTransfer.getData('text/note-path');
            if (notePath) handleMoveNote(notePath, cat.path);
          }}
        >
          <span className={`chevron ${isCollapsed ? '' : 'open'}`} aria-hidden>
            ▶
          </span>
          {isEditing ? (
            <div className="edit-note-form" onClick={(e) => e.stopPropagation()}>
              <input
                ref={focusOnMount}
                type="text"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameCategory(cat);
                  if (e.key === 'Escape') {
                    setEditingCategoryPath(null);
                    setEditingCategoryName('');
                  }
                }}
                onBlur={() => {
                  setEditingCategoryPath(null);
                  setEditingCategoryName('');
                }}
              />
            </div>
          ) : (
            <>
              <span className="category-name">{cat.name}</span>
              <div className="category-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-edit"
                  title="새 노트"
                  onClick={() => startCreate('note', cat.path)}
                >
                  ＋
                </button>
                <button
                  className="btn-edit"
                  title="하위 카테고리"
                  onClick={() => startCreate('category', cat.path)}
                >
                  📁
                </button>
                <button
                  className="btn-edit"
                  title="이름 변경"
                  onClick={() => startRenameCategory(cat)}
                >
                  ✎
                </button>
                <button className="btn-edit" title="삭제" onClick={() => handleDeleteCategory(cat)}>
                  🗑
                </button>
              </div>
            </>
          )}
        </div>

        {!isCollapsed && (
          <>
            {creating && creating.parentPath === cat.path && renderCreateInput(depth + 1)}
            {cat.children.map((child) =>
              child.type === 'category'
                ? renderCategory(child, depth + 1)
                : renderNote(child, depth + 1),
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar" style={{ width: `${width}px` }}>
      <div className="sidebar-header">
        <h3>{currentVault.name}</h3>
        <div className="sidebar-header-actions">
          <button
            className="btn-icon"
            onClick={() => startCreate('category', '')}
            title="새 카테고리"
          >
            📁
          </button>
          <button className="btn-icon" onClick={() => startCreate('note', '')} title="새 노트">
            ＋
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="notes-section">
          <h4>Notes ({notes.length})</h4>
          <div
            className={`tree ${dragOverPath === '__ROOT__' ? 'drag-over-root' : ''}`}
            onDragOver={(e) => {
              // 트리 빈 영역에 드롭하면 루트로 이동.
              e.preventDefault();
              setDragOverPath('__ROOT__');
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragOverPath(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverPath(null);
              const notePath = e.dataTransfer.getData('text/note-path');
              if (notePath) handleMoveNote(notePath, '');
            }}
          >
            {creating && creating.parentPath === '' && renderCreateInput(0)}
            {tree.length === 0 && !creating ? (
              <p className="empty-message">노트가 없습니다. 새로 만들어 보세요!</p>
            ) : (
              tree.map((item) =>
                item.type === 'category' ? renderCategory(item, 0) : renderNote(item, 0),
              )
            )}
          </div>
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
