import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../lib';
import type { ChartDay, RateHistorySeries } from '../lib/rateHistorySeries';

/** How many days the table shows before it offers the rest (§3.18). */
export const VISIBLE_DAYS = 7;

interface RateHistoryTableProps {
  series: RateHistorySeries;
  base: string;
  quote: string;
  /** The day the chart cursor is on, whose row is shaded to match. */
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
}

/**
 * The same series, readable a row at a time — and the accessible fallback for
 * the chart, which is why it carries every number the picture does: the day,
 * both sides of the rate and how the day moved.
 *
 * Newest first, because the number a reader came for is today's and the chart
 * beside it already reads left to right.
 */
export function RateHistoryTable({
  series,
  base,
  quote,
  activeIndex,
  onActivate,
}: RateHistoryTableProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasSpread = series.kind === 'spread';
  const newestFirst = [...series.days].reverse();
  const rows = showAll ? newestFirst : newestFirst.slice(0, VISIBLE_DAYS);
  const latest = series.days.length - 1;

  return (
    <div className="grid gap-3">
      <table
        className="numeric w-full border-collapse font-mono text-xs"
        onMouseLeave={() => {
          onActivate(null);
        }}
      >
        <caption className="sr-only">{t('rateHistory.tableCaption', { base, quote })}</caption>
        <thead>
          <tr className="text-faint text-right text-[0.625rem] tracking-[0.1em] uppercase">
            <th scope="col" className="border-line border-b pb-2 text-left font-medium">
              {t('rateHistory.table.date')}
            </th>
            <th scope="col" className="border-line border-b pb-2 font-medium">
              {t(hasSpread ? 'rateHistory.table.buy' : 'rateHistory.table.cross')}
            </th>
            {hasSpread && (
              <th scope="col" className="border-line border-b pb-2 font-medium">
                {t('rateHistory.table.sell')}
              </th>
            )}
            <th scope="col" className="border-line border-b pb-2 font-medium">
              {t(hasSpread ? 'rateHistory.table.deltaBuy' : 'rateHistory.table.delta')}
            </th>
          </tr>
        </thead>
        <tbody className="text-right">
          {rows.map((day) => (
            <Row
              key={day.date}
              day={day}
              hasSpread={hasSpread}
              isLatest={day.index === latest}
              isActive={day.index === activeIndex}
              onActivate={onActivate}
            />
          ))}
        </tbody>
      </table>

      {rows.length < newestFirst.length && (
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow tracking-[0.12em]">
            {t('rateHistory.showing', { shown: rows.length, total: newestFirst.length })}
          </p>
          <button
            type="button"
            className="text-muted hover:text-ink -my-2 py-2 text-[0.8125rem] font-semibold"
            onClick={() => {
              setShowAll(true);
            }}
          >
            {t('rateHistory.showAll', { total: newestFirst.length })}
          </button>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  day: ChartDay;
  hasSpread: boolean;
  isLatest: boolean;
  isActive: boolean;
  onActivate: (index: number | null) => void;
}

function Row({ day, hasSpread, isLatest, isActive, onActivate }: RowProps) {
  const formatters = useFormatters();
  const cell = 'border-line border-b py-[0.4375rem] sm:py-[0.4375rem]';
  const muted = isLatest ? '' : 'text-muted';

  return (
    <tr
      className={isActive ? 'bg-sunken' : ''}
      onMouseEnter={() => {
        onActivate(day.index);
      }}
    >
      <th
        scope="row"
        className={`${cell} ${muted} text-left font-normal ${isLatest ? 'font-semibold' : ''}`}
      >
        {formatters.archivedDay(day.date)}
      </th>
      <td className={`${cell} ${isLatest ? 'font-semibold' : ''}`}>{formatters.rate(day.value)}</td>
      {hasSpread && (
        <td className={`${cell} ${isLatest ? 'font-semibold' : ''}`}>
          {day.sell === null ? '' : formatters.rate(day.sell)}
        </td>
      )}
      <td className={`${cell} ${muted} ${isLatest ? 'font-semibold' : ''}`}>
        <Delta change={day.change} />
      </td>
    </tr>
  );
}

/**
 * How the day moved, marked by an arrow rather than by colour alone — and the
 * arrow is decorative, with the direction spelled out for a screen reader
 * beside it.
 */
function Delta({ change }: { change: number | null }) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  if (change === null || change === 0) {
    return (
      <>
        <span aria-hidden="true" className={change === null ? 'text-faint' : ''}>
          {t('rateHistory.delta.none')}
        </span>
        <span className="sr-only">{t('rateHistory.delta.noneLabel')}</span>
      </>
    );
  }

  const value = formatters.rate(Math.abs(change));
  const direction = change > 0 ? 'up' : 'down';

  return (
    <>
      <span aria-hidden="true">{t(`rateHistory.delta.${direction}`, { value })}</span>
      <span className="sr-only">{t(`rateHistory.delta.${direction}Label`, { value })}</span>
    </>
  );
}
