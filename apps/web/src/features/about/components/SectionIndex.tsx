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
 * a column for it, and a scrolling chip row above it where there is not.
 *
 * The link is the target and the pill is only what it draws: the chip plus the
 * 8px band above and below it, never less than 44px, so a thumb has something
 * to land on. The band is padding on the anchor rather than a pseudo-element
 * around it, because a pseudo-element is drawn outside the anchor's own box —
 * where this nav's horizontal scrollport, `overflow-x: auto` forcing
 * `overflow-y: auto`, clips it back to the pill.
 */
export function SectionIndex({ entries, active }: SectionIndexProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('about.onThisPage')}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 whitespace-nowrap sm:-mx-6 sm:px-6 lg:sticky lg:top-6 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pt-30"
    >
      <p className="eyebrow hidden px-3 pb-2.5 lg:block">{t('about.onThisPage')}</p>
      {entries.map((entry) => {
        // `location` rather than `true`: this is the section being read, not
        // the page the link would navigate to.
        const isCurrent = entry.id === active;

        return (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            aria-current={isCurrent ? 'location' : undefined}
            className={[
              'inline-flex min-h-11 shrink-0 items-center py-2 no-underline lg:min-h-0 lg:border-l-2 lg:py-0',
              isCurrent ? 'lg:border-accent' : 'lg:border-line',
            ].join(' ')}
          >
            <span
              className={[
                'inline-flex items-center rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors lg:rounded-none lg:border-0 lg:text-sm',
                isCurrent
                  ? 'bg-ink text-surface border-transparent font-semibold lg:bg-transparent lg:text-ink'
                  : 'border-line-strong text-muted lg:hover:text-ink',
              ].join(' ')}
            >
              {t(entry.titleKey)}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
