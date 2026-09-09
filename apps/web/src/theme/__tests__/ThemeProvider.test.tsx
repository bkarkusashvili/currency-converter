import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../ThemeProvider';
import { THEME_ATTRIBUTE, THEME_COLORS, THEME_STORAGE_KEY } from '../themePreference';
import { useTheme } from '../useTheme';

function Consumer() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <p>current {theme}</p>
      <button
        type="button"
        onClick={() => {
          setTheme('dark');
        }}
      >
        go dark
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme('system');
        }}
      >
        go system
      </button>
    </div>
  );
}

function metaFor(scheme: 'light' | 'dark'): HTMLMetaElement {
  const meta = document.querySelector<HTMLMetaElement>(
    `meta[name="theme-color"][media*="${scheme}"]`,
  );
  if (meta === null) {
    throw new Error(`no theme-color meta for ${scheme}`);
  }
  return meta;
}

/** The two tags `index.html` ships, which the provider repoints rather than replaces. */
beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}" />
  `;
});

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  document.head.innerHTML = '';
});

describe('ThemeProvider', () => {
  it('leaves the attribute off for `system`, so prefers-color-scheme still decides', () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    expect(screen.getByText('current system')).toBeInTheDocument();
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    // Each tag keeps its own colour, so the browser chrome follows the OS too.
    expect(metaFor('light').content).toBe(THEME_COLORS.light);
    expect(metaFor('dark').content).toBe(THEME_COLORS.dark);
  });

  it('stamps an explicit pick on <html>, points both meta tags at it and persists it', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'go dark' }));

    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(metaFor('light').content).toBe(THEME_COLORS.dark);
    expect(metaFor('dark').content).toBe(THEME_COLORS.dark);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('takes the stored choice on the first render, not in an effect after it', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    // Set during the state initialiser: by the time anything has rendered, the
    // attribute the pre-paint script wrote is confirmed rather than re-applied.
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(screen.getByText('current light')).toBeInTheDocument();
    expect(metaFor('dark').content).toBe(THEME_COLORS.light);
  });

  it('goes back to following the system when the choice is cleared', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'go system' }));

    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('does nothing about the chrome colour on a document that has no meta tags', async () => {
    const user = userEvent.setup();
    document.head.innerHTML = '';
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'go dark' }));

    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });
});

describe('useTheme', () => {
  it('refuses to answer outside a provider rather than guessing a theme', () => {
    expect(() => render(<Consumer />)).toThrow(/ThemeProvider/);
  });
});
