import { create } from 'zustand';
import type { Vault } from '@memograph/core';

interface VaultState {
  currentVault: Vault | null;
  recentVaults: string[];
  setCurrentVault: (vault: Vault | null) => void;
  addRecentVault: (vaultPath: string) => void;
  loadRecentVaults: () => void;
  saveRecentVaults: () => void;
}

const RECENT_VAULTS_KEY = 'memograph-recent-vaults';

export const useVaultStore = create<VaultState>((set, get) => ({
  currentVault: null,
  recentVaults: [],

  setCurrentVault: (vault) => set({ currentVault: vault }),

  addRecentVault: (vaultPath) => {
    const { recentVaults } = get();
    const filtered = recentVaults.filter((p) => p !== vaultPath);
    const updated = [vaultPath, ...filtered].slice(0, 5);
    set({ recentVaults: updated });
    get().saveRecentVaults();
  },

  loadRecentVaults: () => {
    try {
      const stored = localStorage.getItem(RECENT_VAULTS_KEY);
      if (stored) {
        const vaults = JSON.parse(stored);
        set({ recentVaults: vaults });
      }
    } catch (error) {
      console.error('Failed to load recent vaults:', error);
    }
  },

  saveRecentVaults: () => {
    const { recentVaults } = get();
    try {
      localStorage.setItem(RECENT_VAULTS_KEY, JSON.stringify(recentVaults));
    } catch (error) {
      console.error('Failed to save recent vaults:', error);
    }
  },
}));
