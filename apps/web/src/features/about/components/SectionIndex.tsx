import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

export interface IndexEntry {
  id: string;
  /** A key in the dictionary, so a section renamed there renames its chip too. */
  titleKey: ParseKeys;
}

interface SectionIndexProps {
  entries: readonly IndexEntry[];
  active: string | undefined;
}

/**
 * The same list in two shapes: a sticky rail beside the content where there is
 * a column for it, and a scrolling chip row above it where there is not. The
 * chips carry an invisible taller hit area, so a 30px pill is still a 44px
 * target under a thumb.
 */
export function SectionIndex({ entries, active }: SectionIndexProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('about.onThisPage')}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 whitespace-nowrap sm:-mx-6 sm:px-6 lg:sticky lg:top-6 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pt-30"
    >
      <p className="eyebrow hidden px-3 pb-2.5 lg:block">{t('about.onThisPage')}</p>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          aria-current={entry.id === active ? 'true' : undefined}
          className={[
            'relative inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[0.8125rem] no-underline transition-colors',
            'before:absolute before:inset-x-0 before:-inset-y-2 before:content-[""] lg:before:hidden',
            'lg:rounded-none lg:border-l-2 lg:text-sm',
            entry.id === active
              ? 'bg-ink text-surface border-transparent font-semibold lg:bg-transparent lg:font-semibold lg:text-ink lg:border-accent'
              : 'border-line-strong text-muted border lg:border-0 lg:border-l-2 lg:border-line lg:hover:text-ink',
          ].join(' ')}
        >
          {t(entry.titleKey)}
        </a>
      ))}
    </nav>
  );
}
