import { useTranslation } from 'react-i18next';
import { nextThemePreference, THEME_PREFERENCES, useTheme } from '../theme';
import type { ThemePreference } from '../theme';

const LABEL_KEY = {
  system: 'app.theme.system',
  light: 'app.theme.light',
  dark: 'app.theme.dark',
} as const satisfies Record<ThemePreference, string>;

/**
 * Three segments where there is room for them, one cycling button where there
 * is not — the two shapes the design draws, and only ever one of them in the
 * accessibility tree, because the other is `display:none`.
 *
 * The segments are native radios inside a `radiogroup`, so the arrow keys, the
 * roving focus and the "2 of 3" a screen reader reads out are the platform's
 * rather than a re-implementation of them.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t('app.theme.label')}
        className="border-line bg-raised dark:border-line-strong hidden items-center gap-0.5 rounded-lg border p-0.5 sm:flex"
      >
        {THEME_PREFERENCES.map((preference) => (
          <label
            key={preference}
            title={t(LABEL_KEY[preference])}
            className={[
              'inline-flex h-[1.875rem] w-8 cursor-pointer items-center justify-center rounded-md transition-colors',
              'has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              theme === preference ? 'bg-sunken text-ink' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            <input
              type="radio"
              name="theme"
              value={preference}
              className="sr-only"
              checked={theme === preference}
              onChange={() => {
                setTheme(preference);
              }}
            />
            <span className="sr-only">{t(LABEL_KEY[preference])}</span>
            <ThemeIcon theme={preference} className="h-[0.9375rem] w-[0.9375rem]" />
          </label>
        ))}
      </div>

      <button
        type="button"
        title={t('app.theme.current', { mode: t(LABEL_KEY[theme]) })}
        aria-label={t('app.theme.current', { mode: t(LABEL_KEY[theme]) })}
        onClick={() => {
          setTheme(nextThemePreference(theme));
        }}
        className="border-line text-muted -mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border sm:hidden"
      >
        <ThemeIcon theme={theme} className="h-4 w-4" />
      </button>
    </>
  );
}

/** Monitor, sun, crescent — drawn on the same 16-unit grid at stroke 1.5. */
function ThemeIcon({ theme, className }: { theme: ThemePreference; className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {theme === 'system' && (
        <>
          <rect x="2" y="3" width="12" height="8" rx="1.5" />
          <path d="M6 14h4M8 11v3" strokeLinecap="round" />
        </>
      )}
      {theme === 'light' && (
        <>
          <circle cx="8" cy="8" r="3" />
          <path
            d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"
            strokeLinecap="round"
          />
        </>
      )}
      {theme === 'dark' && (
        <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" strokeLinejoin="round" />
      )}
    </svg>
  );
}
