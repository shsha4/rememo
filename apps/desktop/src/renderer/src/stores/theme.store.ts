import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'rememo-theme';

/**
 * 사용자 선호(preference)와 OS 다크모드 여부로 실제 적용할 테마를 결정한다.
 * 순수 함수 — 단위 테스트 대상.
 */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

function loadPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* localStorage 접근 불가(테스트 환경 등) — 기본값 사용 */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return true;
}

function applyEffective(effective: EffectiveTheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = effective;
  }
}

interface ThemeState {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const preference = loadPreference();
  const effective = resolveEffectiveTheme(preference, systemPrefersDark());

  // 선호가 '시스템'일 때 OS 다크모드 토글에 실시간 반응한다.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (event) => {
      if (get().preference !== 'system') return;
      const next = event.matches ? 'dark' : 'light';
      applyEffective(next);
      set({ effective: next });
    });
  }

  return {
    preference,
    effective,
    setPreference: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* 저장 실패해도 이번 세션 적용은 진행 */
      }
      const nextEffective = resolveEffectiveTheme(next, systemPrefersDark());
      applyEffective(nextEffective);
      set({ preference: next, effective: nextEffective });
    },
  };
});

/** 앱 시작 시 호출: 저장된 선호로 <html data-theme>를 즉시 맞춘다. */
export function initTheme(): void {
  applyEffective(useThemeStore.getState().effective);
}
