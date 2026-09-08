import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../api/hooks/useHistory';
import type { HistoryItem } from '../../../api/types';
import { EmptyMark } from '../../../components/EmptyMark';
import { InfoBadge } from '../../../components/InfoBadge';
import { Skeleton } from '../../../components/Skeleton';
import { Timestamp } from '../../../components/Timestamp';
import { WarningIcon } from '../../../components/WarningIcon';
import { useFormatters } from '../../../lib/useFormatters';
import { sourceCopy, strategyCopy } from '../lib/provenance';

export const HISTORY_LIMIT = 10;

export function HistoryPanel() {
  const { t } = useTranslation();
  const { data, isPending, error } = useHistory(HISTORY_LIMIT);

  return (
    <section aria-labelledby="history-heading" className="mt-12">
      <div className="border-line flex items-baseline justify-between gap-4 border-b pb-3">
        <h2 id="history-heading" className="text-base">
          {t('converter.history.heading')}
        </h2>
        <p className="eyebrow">{t('converter.history.limit', { count: HISTORY_LIMIT })}</p>
      </div>

      {isPending && <HistorySkeleton />}

      {error !== null && (
        <div className="text-muted flex items-start gap-2.5 py-6 text-sm">
          <WarningIcon className="text-warn mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t('converter.history.unavailable')}
            <span className="text-faint mt-1 block font-mono text-xs">{error.message}</span>
          </span>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && <HistoryEmpty />}

      {data !== undefined && data.items.length > 0 && (
        <ul>
          {data.items.map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  // The same copy the result card uses, so one strategy never reads two ways.
  const strategy = strategyCopy(item.strategy);
  const source = sourceCopy(item.source);

  return (
    <li className="border-line grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b py-3.5">
      <span className="numeric font-mono text-sm break-words">
        {formatters.money(item.amount)} {item.from} <span className="text-faint">→</span>{' '}
        <span className="font-semibold">
          {formatters.money(item.result)} {item.to}
        </span>
      </span>
      <Timestamp value={item.createdAt} className="text-faint numeric font-mono text-xs" />
      <span className="text-muted numeric font-mono text-xs">
        {t('converter.history.rate', {
          from: item.from,
          rate: formatters.rate(item.rate),
          to: item.to,
        })}
      </span>
      <span className="flex items-center justify-end gap-2">
        <span className="text-faint font-mono text-[0.6875rem] tracking-[0.1em] uppercase">
          {strategy.valueKey === null ? item.strategy : t(strategy.valueKey)}
        </span>
        <InfoBadge
          value={source.valueKey === null ? item.source : t(source.valueKey)}
          tone={source.tone}
        />
      </span>
    </li>
  );
}

function HistoryEmpty() {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-12 text-center">
      <EmptyMark className="text-faint mx-auto h-8 w-8" />
      <p className="mt-4 font-semibold">{t('converter.history.emptyHeading')}</p>
      <p className="text-muted mx-auto mt-1.5 max-w-sm text-sm text-pretty">
        {t('converter.history.empty', { count: HISTORY_LIMIT })}
      </p>
    </div>
  );
}

const SKELETON_ROWS = [0, 1, 2];

function HistorySkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status">
      <span className="sr-only">{t('converter.history.loading')}</span>
      <ul aria-hidden="true">
        {SKELETON_ROWS.map((row) => (
          <li
            key={row}
            className="border-line grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 border-b py-3.5"
          >
            <Skeleton className="h-3.5 w-56 max-w-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-3 w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}
