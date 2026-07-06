import { useState, useEffect, useCallback } from 'react';
import { electronAPI } from '../api/electron-api';
import { useVaultStore } from '../stores/vault.store';
import { useNoteStore } from '../stores/note.store';
import type { TodoItem } from '../../../preload/index';
import './TodoPage.css';

interface TodoPageProps {
  onNavigateToEditor: () => void;
}

type Group = {
  key: string;
  label: string;
  todos: TodoItem[];
};

// 로컬 기준 오늘 날짜를 YYYY-MM-DD로 반환
function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// dueDate('YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm')에서 날짜 부분만 추출
function datePart(dueDate: string): string {
  return dueDate.split('T')[0];
}

function TodoPage({ onNavigateToEditor }: TodoPageProps) {
  const { currentVault } = useVaultStore();
  const { currentNote, setCurrentNote } = useNoteStore();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTodos = useCallback(async () => {
    if (!currentVault) return;
    setLoading(true);
    try {
      const list = await electronAPI.todo.list(currentVault.path);
      setTodos(list);
    } catch (error) {
      console.error('Failed to load todos:', error);
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [currentVault]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // 할 일 변경으로 노트 파일이 바뀌었을 때, 그 노트가 현재 에디터에 열린 노트면
  // 다시 읽어 스토어를 갱신한다(에디터에 실시간 반영).
  const refreshCurrentNoteIfMatches = async (notePath: string) => {
    if (!currentVault || currentNote?.path !== notePath) return;
    try {
      const note = await electronAPI.note.read(notePath, currentVault.id);
      setCurrentNote(note);
    } catch (error) {
      console.error('Failed to refresh current note:', error);
    }
  };

  const handleToggle = async (todo: TodoItem) => {
    if (!currentVault) return;
    try {
      await electronAPI.todo.toggle(currentVault.path, todo.notePath, todo.line, currentVault.id);
      await loadTodos();
      await refreshCurrentNoteIfMatches(todo.notePath);
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  // 날짜 선택기에서 마감일을 설정/변경/삭제한다. pickedDate가 ''이면 삭제.
  const handleSetDue = async (todo: TodoItem, pickedDate: string) => {
    if (!currentVault) return;
    let dueDate: string | null = null;
    if (pickedDate) {
      // 기존에 시각이 있었으면 유지하고 날짜만 바꾼다.
      const oldTime =
        todo.hasTime && todo.dueDate?.includes('T') ? todo.dueDate.split('T')[1] : null;
      dueDate = oldTime ? `${pickedDate}T${oldTime}` : pickedDate;
    }
    try {
      await electronAPI.todo.setDue(
        currentVault.path,
        todo.notePath,
        todo.line,
        dueDate,
        currentVault.id,
      );
      await loadTodos();
      await refreshCurrentNoteIfMatches(todo.notePath);
    } catch (error) {
      console.error('Failed to set due date:', error);
    }
  };

  const handleOpenNote = async (todo: TodoItem) => {
    if (!currentVault) return;
    try {
      const note = await electronAPI.note.read(todo.notePath, currentVault.id);
      setCurrentNote(note);
      onNavigateToEditor();
    } catch (error) {
      console.error('Failed to open note:', error);
    }
  };

  // 그룹화: 지남 / 오늘 / 예정 / 마감 없음 / 완료
  const buildGroups = (): Group[] => {
    const today = todayStr();
    const overdue: TodoItem[] = [];
    const dueToday: TodoItem[] = [];
    const upcoming: TodoItem[] = [];
    const noDue: TodoItem[] = [];
    const completed: TodoItem[] = [];

    for (const todo of todos) {
      if (todo.completed) {
        completed.push(todo);
        continue;
      }
      if (!todo.dueDate) {
        noDue.push(todo);
        continue;
      }
      const d = datePart(todo.dueDate);
      if (d < today) overdue.push(todo);
      else if (d === today) dueToday.push(todo);
      else upcoming.push(todo);
    }

    return [
      { key: 'overdue', label: '지남', todos: overdue },
      { key: 'today', label: '오늘', todos: dueToday },
      { key: 'upcoming', label: '예정', todos: upcoming },
      { key: 'noDue', label: '마감 없음', todos: noDue },
      { key: 'completed', label: '완료', todos: completed },
    ].filter((g) => g.todos.length > 0);
  };

  const groups = buildGroups();
  const activeCount = todos.filter((t) => !t.completed).length;

  return (
    <div className="todo-page">
      <div className="todo-header">
        <h2>할 일</h2>
        <span className="todo-count">미완료 {activeCount}개</span>
      </div>

      {loading ? (
        <div className="todo-empty">불러오는 중...</div>
      ) : todos.length === 0 ? (
        <div className="todo-empty">
          할 일이 없습니다. 노트에 <code>- [ ] 할 일</code> 형태로 적어보세요.
        </div>
      ) : (
        <div className="todo-groups">
          {groups.map((group) => (
            <div key={group.key} className={`todo-group todo-group-${group.key}`}>
              <h3 className="todo-group-title">
                {group.label} <span className="todo-group-count">{group.todos.length}</span>
              </h3>
              <ul className="todo-list">
                {group.todos.map((todo, index) => (
                  <li key={`${todo.notePath}-${todo.line}-${index}`} className="todo-item">
                    <input
                      type="checkbox"
                      className="todo-checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggle(todo)}
                    />
                    <div className="todo-body" onClick={() => handleOpenNote(todo)}>
                      <span className={`todo-text ${todo.completed ? 'done' : ''}`}>
                        {todo.text}
                      </span>
                      <span className="todo-note">{todo.noteTitle}</span>
                    </div>
                    <div className="todo-controls">
                      <input
                        type="date"
                        className={`todo-due-input todo-due-${group.key}`}
                        value={todo.dueDate ? datePart(todo.dueDate) : ''}
                        title="마감일 선택"
                        onChange={(e) => handleSetDue(todo, e.target.value)}
                      />
                      {todo.hasTime && todo.dueDate?.includes('T') && (
                        <span className="todo-time">{todo.dueDate.split('T')[1]}</span>
                      )}
                      {todo.dueDate && (
                        <button
                          className="todo-due-clear"
                          title="마감일 삭제"
                          onClick={() => handleSetDue(todo, '')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TodoPage;
