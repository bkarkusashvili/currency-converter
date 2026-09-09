/** The theme preference: its provider, its hook, and the values both sides of the pre-paint script share. */
export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
export type { ThemeState } from './ThemeContext';
export {
  DEFAULT_THEME,
  isThemePreference,
  nextThemePreference,
  THEME_ATTRIBUTE,
  THEME_COLORS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from './themePreference';
export type { ThemePreference } from './themePreference';
