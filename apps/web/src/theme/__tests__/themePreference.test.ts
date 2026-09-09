import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  isThemePreference,
  nextThemePreference,
  THEME_PREFERENCES,
} from '../themePreference';

describe('isThemePreference', () => {
  it('accepts the three the app knows and nothing else', () => {
    for (const preference of THEME_PREFERENCES) {
      expect(isThemePreference(preference)).toBe(true);
    }

    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(2)).toBe(false);
  });
});

describe('nextThemePreference', () => {
  it('cycles the one button through all three and back', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });

  it('starts from the default, which is what an unset preference means', () => {
    expect(DEFAULT_THEME).toBe('system');
    expect(THEME_PREFERENCES[0]).toBe(DEFAULT_THEME);
  });
});
