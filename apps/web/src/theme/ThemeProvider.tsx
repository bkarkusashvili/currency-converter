import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { applyTheme } from './applyTheme';
import { ThemeContext, type ThemeState } from './ThemeContext';
import type { ThemePreference } from './themePreference';
import { readStoredTheme, writeStoredTheme } from './themeStorage';

/**
 * The choice, and the three places it has to land: the attribute on `<html>`,
 * the `theme-color` tags, and `localStorage`. The initial read happens in the
 * state initialiser rather than in an effect, because the pre-paint script has
 * already applied the same value and a second pass after the first paint is
 * what a flash looks like.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = readStoredTheme();
    // The script in `index.html` sets the attribute; the meta tags are this
    // module's job, and a reload has to reach them too.
    applyTheme(stored);
    return stored;
  });

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    applyTheme(next);
    writeStoredTheme(next);
  }, []);

  const value = useMemo<ThemeState>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
