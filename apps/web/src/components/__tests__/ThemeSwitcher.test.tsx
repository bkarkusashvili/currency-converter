import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18nInstance } from '../../i18n';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider } from '../../theme';
import { ThemeSwitcher } from '../ThemeSwitcher';

function renderSwitcher() {
  return render(
    <I18nextProvider i18n={i18nInstance}>
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    </I18nextProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('ThemeSwitcher', () => {
  it('is a radio group of three, named, with the current choice checked', () => {
    renderSwitcher();

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const radios = within(group).getAllByRole('radio');

    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['system', 'light', 'dark']);
    // One `name`, so the arrow keys and the roving focus are the platform's.
    expect(radios.every((radio) => (radio as HTMLInputElement).name === 'theme')).toBe(true);
    expect(within(group).getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it('applies and persists the segment that is picked', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('offers one button under 640 that cycles all three and says which it is on', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    const cycle = () => screen.getByRole('button', { name: /^Theme: / });
    expect(cycle()).toHaveAccessibleName('Theme: System');

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName('Theme: Light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName('Theme: Dark');

    await user.click(cycle());
    expect(cycle()).toHaveAccessibleName('Theme: System');
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('names every segment for a screen reader as well as for a pointer', () => {
    renderSwitcher();

    for (const label of ['System', 'Light', 'Dark']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
      expect(screen.getByTitle(label)).toBeInTheDocument();
    }
  });
});
