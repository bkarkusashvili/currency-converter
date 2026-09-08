import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { REPO_URL } from '../lib/links';
import { ExchangeMark } from './ExchangeMark';

const NAV_ITEMS = [
  { to: '/', labelKey: 'app.nav.converter' },
  { to: '/about', labelKey: 'app.nav.about' },
] as const;

export function AppHeader() {
  const { t } = useTranslation();

  return (
    <header className="border-line bg-raised border-b">
      <div className="shell flex h-16 items-center gap-3 sm:gap-4">
        <NavLink
          to="/"
          className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-md pr-1 no-underline"
        >
          <ExchangeMark className="text-faint h-5 w-5" />
          <span className="text-[0.9375rem] font-bold tracking-tight whitespace-nowrap">
            {t('app.title')}
          </span>
        </NavLink>

        <nav aria-label={t('app.nav.label')} className="ml-auto flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'inline-flex min-h-11 items-center rounded-md px-3 text-sm no-underline transition-colors',
                  isActive ? 'text-ink bg-sunken font-semibold' : 'text-muted hover:text-ink',
                ].join(' ')
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-ink hidden min-h-11 items-center rounded-md px-2 font-mono text-xs tracking-[0.08em] whitespace-nowrap uppercase no-underline transition-colors sm:inline-flex"
        >
          {t('app.nav.repository')} <span aria-hidden="true">&nbsp;↗</span>
        </a>
      </div>
    </header>
  );
}
