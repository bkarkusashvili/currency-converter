import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../api';
import type { HistoryItem } from '../../../api';
import { EmptyMark, InfoBadge, Skeleton, Timestamp, WarningIcon } from '../../../components';
import { useApiErrorMessage, useFormatters } from '../../../lib';
import { conversionIdentity } from '../lib/conversionIdentity';
import { ARCHIVE_SOURCE, sourceCopy, strategyCopy } from '../lib/provenance';
import { ArchiveDate } from './ArchiveDate';

export const HISTORY_LIMIT = 10;

/** The strategy's treatment, which every source that needs no warning shares. */
const TAG_CLASS = 'font-mono tracking-[0.1em] uppercase';

interface HistoryPanelProps {
  /**
   * The conversion showing in the card, so the row it produced can be marked
   * as the one that just landed. Null when nothing has been converted, or when
   * what was converted was an estimate the API never recorded.
   */
  highlight?: string | null;
}

export function HistoryPanel({ highlight = null }: HistoryPanelProps) {
  const { t } = useTranslation();
  const messageOf = useApiErrorMessage();
  const { data, isPending, error } = useHistory(HISTORY_LIMIT);
  // Only the first match: two identical conversions of one snapshot are two
  // rows, and the newer one is the one on screen.
  const highlighted = data?.items.find((item) => conversionIdentity(item) === highlight);

  return (
    <section aria-labelledby="history-heading">
      <div className="border-line flex items-baseline justify-between gap-4 border-b pb-2.5 sm:pb-3">
        <h2 id="history-heading" className="text-base">
          {t('converter.history.heading')}
        </h2>
        <p className="eyebrow">{t('converter.history.limit', { count: HISTORY_LIMIT })}</p>
      </div>

      {isPending && <HistorySkeleton />}

      {error !== null && (
        <div className="text-muted flex items-start gap-2.5 py-5 text-sm">
          <WarningIcon className="text-warn mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t('converter.history.unavailable')}
            {/* The same reading of the envelope every other failure gets, so
                "Cannot GET /api/v1/history" cannot reach the page. */}
            <span className="text-faint mt-1 block text-xs">{messageOf(error)}</span>
          </span>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && <HistoryEmpty />}

      {data !== undefined && data.items.length > 0 && (
        <ul>
          {data.items.map((item) => (
            <HistoryRow key={item.id} item={item} isLatest={item === highlighted} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ item, isLatest }: { item: HistoryItem; isLatest: boolean }) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  // The same copy the result card uses, so one strategy never reads two ways.
  const strategy = strategyCopy(item.strategy);
  const source = sourceCopy(item.source);
  // A badge on every row makes the heaviest element in the column carry the
  // least information. Only a source that needs explaining wears one, and only
  // that row says how old the rate behind it was.
  const needsExplaining = source.tone === 'warn';
  const strategyText = strategy.valueKey === null ? item.strategy : t(strategy.valueKey);
  const sourceText = source.valueKey === null ? item.source : t(source.valueKey);

  return (
    <li
      className={[
        'numeric border-line grid gap-1 border-b font-mono',
        isLatest
          ? `-mx-3 rounded-b-lg p-3 ${needsExplaining ? 'bg-warn-soft' : 'bg-accent-soft'}`
          : 'py-3',
      ].join(' ')}
    >
      <div className="flex justify-between gap-3 text-[0.8125rem]">
        <span className="break-words">
          {formatters.money(item.amount)} {item.from} <span className="text-faint">→</span>{' '}
          <span className="font-semibold">
            {formatters.money(item.result)} {item.to}
          </span>
        </span>
        <Timestamp value={item.createdAt} className="text-faint shrink-0 text-xs" />
      </div>

      <div className="text-muted flex items-center justify-between gap-3 text-[0.6875rem]">
        <span>
          {t('converter.history.rate', {
            from: item.from,
            rate: formatters.rate(item.rate),
            to: item.to,
          })}
        </span>
        {needsExplaining ? (
          <span className="inline-flex shrink-0 items-center gap-2">
            <span className={`${TAG_CLASS} text-faint`}>{strategyText}</span>
            {/* On a warn-tinted row the warn pill needs the opposite ground,
                the same rule the badges on the sunken pane follow (§6.5). */}
            <InfoBadge value={sourceText} tone="warn" compact onSunken={isLatest} />
          </span>
        ) : (
          <span className={`${TAG_CLASS} shrink-0 ${isLatest ? 'text-accent' : 'text-faint'}`}>
            {t('converter.history.tags', { strategy: strategyText, source: sourceText })}
          </span>
        )}
      </div>

      {needsExplaining && (
        <p className="text-warn text-[0.6875rem]">
          {/* The same sentence the result card uses for the same fact — which
              for an archived answer is a date, because that is all its rates
              are dated to. */}
          {item.source === ARCHIVE_SOURCE ? (
            <ArchiveDate value={item.ratesTimestamp} />
          ) : (
            <>
              {t('converter.result.ratesFetched')}{' '}
              <Timestamp value={item.ratesTimestamp} withPreposition />
            </>
          )}
        </p>
      )}
    </li>
  );
}

function HistoryEmpty() {
  const { t } = useTranslation();

  return (
    <div className="grid justify-items-center gap-1.5 px-4 py-12 text-center">
      <EmptyMark className="text-faint h-8 w-8" />
      <p className="mt-2.5 font-semibold">{t('converter.history.emptyHeading')}</p>
      <p className="text-muted max-w-[15.625rem] text-sm text-pretty">
        {t('converter.history.empty', { count: HISTORY_LIMIT })}
      </p>
    </div>
  );
}

const SKELETON_ROWS = [
  { wide: 'w-[85%]', narrow: 'w-[60%]' },
  { wide: 'w-[75%]', narrow: 'w-[50%]' },
  { wide: 'w-[90%]', narrow: 'w-[55%]' },
];

function HistorySkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status">
      <span className="sr-only">{t('converter.history.loading')}</span>
      <ul aria-hidden="true">
        {SKELETON_ROWS.map((row) => (
          <li key={row.wide} className="border-line grid gap-2 border-b py-3.5">
            <Skeleton className={`h-3 rounded-[0.25rem] ${row.wide}`} />
            <Skeleton className={`h-2.5 rounded-[0.25rem] ${row.narrow}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
