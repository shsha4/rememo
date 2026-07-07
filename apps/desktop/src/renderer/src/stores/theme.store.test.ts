import { describe, it, expect } from 'vitest';
import { resolveEffectiveTheme } from './theme.store';

describe('resolveEffectiveTheme', () => {
  it("'light' 선호는 OS 설정과 무관하게 항상 light", () => {
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('light', false)).toBe('light');
  });

  it("'dark' 선호는 OS 설정과 무관하게 항상 dark", () => {
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
  });

  it("'system' 선호는 OS 다크모드 여부를 따른다", () => {
    expect(resolveEffectiveTheme('system', true)).toBe('dark');
    expect(resolveEffectiveTheme('system', false)).toBe('light');
  });
});
