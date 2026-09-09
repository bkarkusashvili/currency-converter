import { createContext } from 'react';
import type { ThemePreference } from './themePreference';

export interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);
