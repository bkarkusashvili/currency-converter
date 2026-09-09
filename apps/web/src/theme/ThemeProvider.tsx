import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme } from './applyTheme';
import { ThemeContext, type ThemeState } from './ThemeContext';
import type { ThemePreference } from './themePreference';
import { readStoredTheme, writeStoredTheme } from './themeStorage';

/**
 * The choice, and the three places it has to land: the attribute on `<html>`,
 * the `theme-color` tags, and `localStorage`.
 *
 * The attribute is the pre-paint script's to write — it runs in `index.html`
 * before the bundle exists, which is what stops a reload flashing the other
 * palette. This provider confirms the same value and points the meta tags at
 * it in a layout effect: still before the browser paints, and outside the
 * render pass, which has no business writing to the document.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const value = useMemo<ThemeState>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
