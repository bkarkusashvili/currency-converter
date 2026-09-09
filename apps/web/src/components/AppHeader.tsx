import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { REPO_URL } from '../lib';
import { ExchangeMark } from './ExchangeMark';
import { ThemeSwitcher } from './ThemeSwitcher';

const NAV_ITEMS = [
  { to: '/', labelKey: 'app.nav.converter' },
  { to: '/about', labelKey: 'app.nav.about' },
] as const;

export function AppHeader() {
  const { t } = useTranslation();

  return (
    <header className="border-line bg-raised border-b">
      <div className="shell flex h-14 items-center gap-2 sm:h-16 sm:gap-4">
        <NavLink
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-md no-underline sm:gap-2.5"
        >
          <ExchangeMark className="text-faint h-5 w-5" />
          <span className="truncate text-[0.9375rem] font-bold tracking-[-0.01em]">
            {t('app.title')}
          </span>
        </NavLink>

        <nav
          aria-label={t('app.nav.label')}
          className="ml-auto flex shrink-0 items-center gap-2 sm:gap-0.5"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'inline-flex h-11 shrink-0 items-center rounded-md text-sm no-underline transition-colors sm:h-9 sm:px-3',
                  isActive ? 'text-ink font-semibold sm:bg-sunken' : 'text-muted hover:text-ink',
                ].join(' ')
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <ThemeSwitcher />

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-ink hidden items-center rounded-md px-2 font-mono text-xs tracking-[0.08em] whitespace-nowrap uppercase no-underline transition-colors sm:inline-flex"
        >
          {t('app.nav.repository')} <span aria-hidden="true">&nbsp;↗</span>
        </a>
      </div>
    </header>
  );
}
