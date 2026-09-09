import { THEME_ATTRIBUTE, THEME_COLORS } from './themePreference';
import type { ThemePreference } from './themePreference';

/**
 * Puts the choice on `<html>` — where `index.css` reads it — and points both
 * `theme-color` tags at the surface the reader will actually see. `system`
 * removes the attribute so `prefers-color-scheme` decides again, and leaves
 * each tag on its own colour so the browser chrome follows the OS with it.
 */
export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;

  if (theme === 'system') {
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    root.setAttribute(THEME_ATTRIBUTE, theme);
  }

  setThemeColor('light', theme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light);
  setThemeColor('dark', theme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark);
}

function setThemeColor(scheme: 'light' | 'dark', color: string): void {
  const meta = document.querySelector<HTMLMetaElement>(
    `meta[name="theme-color"][media*="${scheme}"]`,
  );

  if (meta !== null) {
    meta.content = color;
  }
}
