import { useTranslation } from 'react-i18next';
import { useHistory } from '../../../api/hooks/useHistory';
import type { HistoryItem } from '../../../api/types';
import { Timestamp } from '../../../components/Timestamp';
import { useFormatters } from '../../../lib/useFormatters';

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
        <div className="py-6">
          <p className="text-muted text-sm">{t('converter.history.unavailable')}</p>
          <p className="text-faint mt-1 font-mono text-xs">{error.message}</p>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && (
        <p className="text-muted py-6 text-sm">
          {t('converter.history.empty', { count: HISTORY_LIMIT })}
        </p>
      )}

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

  return (
    <li className="border-line grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b py-3">
      <span className="numeric font-mono text-sm">
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
      <span className="text-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
        {item.strategy}
      </span>
    </li>
  );
}

function HistorySkeleton() {
  return (
    <ul aria-hidden="true" className="animate-pulse">
      {[0, 1, 2].map((row) => (
        <li key={row} className="border-line flex items-center justify-between border-b py-4">
          <span className="bg-sunken h-3 w-48 rounded" />
          <span className="bg-sunken h-3 w-12 rounded" />
        </li>
      ))}
    </ul>
  );
}
