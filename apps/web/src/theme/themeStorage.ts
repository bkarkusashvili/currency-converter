import { DEFAULT_THEME, isThemePreference, THEME_STORAGE_KEY } from './themePreference';
import type { ThemePreference } from './themePreference';

/**
 * `localStorage` is not something a browser can be assumed to have — the
 * property itself throws when site data is blocked, and `setItem` throws on a
 * full quota or in a private window. A theme is a preference, not a
 * requirement: every call is guarded and the default stands when storage will
 * not answer.
 */
export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: ThemePreference): void {
  try {
    if (theme === DEFAULT_THEME) {
      // Nothing to remember: `system` is what an absent key already means, and
      // leaving it out keeps a stale pick from outliving a cleared preference.
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies to this page; it just will not survive it.
  }
}
