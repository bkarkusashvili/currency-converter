import { NavLink } from 'react-router';
import { REPO_URL } from '../lib/links';
import { ExchangeMark } from './ExchangeMark';

const NAV_ITEMS = [
  { to: '/', label: 'Converter' },
  { to: '/about', label: 'About' },
] as const;

export function AppHeader() {
  return (
    <header className="border-line bg-raised sticky top-0 z-10 border-b">
      <div className="shell flex h-16 items-center gap-4">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5 no-underline">
          <ExchangeMark className="text-faint h-5 w-5" />
          <span className="text-[0.9375rem] font-bold tracking-tight whitespace-nowrap">
            Currency Converter
          </span>
        </NavLink>

        <nav aria-label="Main" className="ml-auto flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors',
                  isActive ? 'text-ink font-semibold' : 'text-muted hover:text-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-ink hidden font-mono text-xs tracking-[0.08em] whitespace-nowrap uppercase no-underline transition-colors sm:inline"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}
