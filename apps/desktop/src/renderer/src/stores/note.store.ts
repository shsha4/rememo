import { create } from 'zustand';
import type { Note } from '../types';

interface NoteState {
  notes: string[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;
  graphRefreshTrigger: number;
  // 현재 열린 노트에 미저장 편집이 있으면 그 경로, 없으면 null.
  // 외부 변경 push가 왔을 때 열린 노트를 덮어쓸지(안전 모드) 판단하는 데 쓴다.
  dirtyNotePath: string | null;
  // 열린 노트가 외부에서 변경됐지만 미저장 편집 때문에 자동 반영을 보류한 경우 그 경로.
  // 에디터가 이 값으로 "외부 변경됨 - 새로고침" 배너를 띄운다.
  externalChangePath: string | null;
  setNotes: (notes: string[]) => void;
  setCurrentNote: (note: Note | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  triggerGraphRefresh: () => void;
  setDirtyNotePath: (path: string | null) => void;
  setExternalChangePath: (path: string | null) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,
  graphRefreshTrigger: 0,
  dirtyNotePath: null,
  externalChangePath: null,
  setNotes: (notes) => set({ notes }),
  // 노트를 새로 세팅하면 이전 노트의 미저장/외부변경 상태는 무의미하므로 함께 초기화한다.
  setCurrentNote: (note) =>
    set({ currentNote: note, dirtyNotePath: null, externalChangePath: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  triggerGraphRefresh: () =>
    set((state) => ({ graphRefreshTrigger: state.graphRefreshTrigger + 1 })),
  setDirtyNotePath: (path) => set({ dirtyNotePath: path }),
  setExternalChangePath: (path) => set({ externalChangePath: path }),
}));
