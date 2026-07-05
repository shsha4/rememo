import { create } from 'zustand';

interface AppState {
  currentVault: string | null;
  setCurrentVault: (vault: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentVault: null,
  setCurrentVault: (vault) => set({ currentVault: vault }),
}));
