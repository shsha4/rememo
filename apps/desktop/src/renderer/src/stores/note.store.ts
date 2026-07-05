import { create } from 'zustand';
import type { Note } from '../types';

interface NoteState {
  notes: string[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;
  graphRefreshTrigger: number;
  setNotes: (notes: string[]) => void;
  setCurrentNote: (note: Note | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  triggerGraphRefresh: () => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,
  graphRefreshTrigger: 0,
  setNotes: (notes) => set({ notes }),
  setCurrentNote: (note) => set({ currentNote: note }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  triggerGraphRefresh: () => set((state) => ({ graphRefreshTrigger: state.graphRefreshTrigger + 1 })),
}));
