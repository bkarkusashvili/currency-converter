import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '../themePreference';
import { readStoredTheme, writeStoredTheme } from '../themeStorage';

afterEach(() => {
  window.localStorage.clear();
});

describe('readStoredTheme', () => {
  it('reads back what was written', () => {
    writeStoredTheme('dark');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('falls back to the default for nothing stored and for nonsense stored', () => {
    expect(readStoredTheme()).toBe('system');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(readStoredTheme()).toBe('system');
  });

  it('falls back to the default when storage refuses to answer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(readStoredTheme()).toBe('system');
  });
});

describe('writeStoredTheme', () => {
  it('removes the key for `system`, which is what an absent key already means', () => {
    writeStoredTheme('light');
    writeStoredTheme('system');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('keeps the choice for this page when storage will not take it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });

    expect(() => {
      writeStoredTheme('dark');
    }).not.toThrow();
  });
});
