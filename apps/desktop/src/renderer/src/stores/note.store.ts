import { create } from 'zustand';
import type { Note } from '@memograph/core';

interface NoteState {
  notes: string[];
  currentNote: Note | null;
  isLoading: boolean;
  error: string | null;
  setNotes: (notes: string[]) => void;
  setCurrentNote: (note: Note | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,
  setNotes: (notes) => set({ notes }),
  setCurrentNote: (note) => set({ currentNote: note }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
