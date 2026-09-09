/**
 * What the reader picked, which is not the same as what they see: `system`
 * defers to `prefers-color-scheme`, and only the other two put an attribute on
 * `<html>`. The CSS in `index.css` is keyed on that attribute, so the palette
 * switch needs no class list and no re-render below this module.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME: ThemePreference = 'system';

/**
 * Read by the pre-paint script in `index.html` as well as by this module, so
 * an explicit choice is on `<html>` before the first frame rather than after
 * the bundle has parsed. `prePaintScript.test.ts` holds the two in step.
 */
export const THEME_STORAGE_KEY = 'currency-converter:theme';

export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The browser-chrome colour per theme: the two `--surface` values, needed by
 * the `theme-color` meta tags, which are read before any stylesheet is.
 * `themeTokens.test.ts` asserts they are still what `index.css` declares.
 */
export const THEME_COLORS = { light: '#f3f5f3', dark: '#0d1113' } as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** What the one mobile button moves to on its next press. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? DEFAULT_THEME;
}
