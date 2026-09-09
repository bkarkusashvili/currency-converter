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
  /**
   * Whether the window is open to its full height. Held by the panel, because
   * it belongs to the pair and the window rather than to this table: switching
   * either is a different series, and it opens closed again.
   */
  showAll: boolean;
  onShowAll: () => void;
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
  showAll,
  onShowAll,
}: RateHistoryTableProps) {
  const { t } = useTranslation();
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
          {rows.map((day, position) => (
            <Row
              key={day.date}
              day={day}
              hasSpread={hasSpread}
              isLatest={day.index === latest}
              isActive={day.index === activeIndex}
              // The rule under the last row would be the table underlining
              // nothing (board 3a and board 3d both stop at the row above).
              isLast={position === rows.length - 1}
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
          {/* Flat, as the board draws it — but a 44px target with a ring of
              its own, because a control with no box of its own still has to be
              hittable and still has to show where the focus is (§3.19). */}
          <button
            type="button"
            className="text-muted hover:text-ink focus-visible:outline-accent -my-3 inline-flex h-11 items-center rounded-md px-1 text-[0.8125rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={onShowAll}
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
  /** The bottom row of what is shown, which carries no rule under it. */
  isLast: boolean;
  onActivate: (index: number | null) => void;
}

function Row({ day, hasSpread, isLatest, isActive, isLast, onActivate }: RowProps) {
  const formatters = useFormatters();
  // 9px a row on a phone, 7px above it: board 3d gives the rows the extra two
  // pixels a thumb wants, and board 3a does not need them (§3.18).
  const cell = `py-[0.5625rem] sm:py-[0.4375rem] ${isLast ? '' : 'border-line border-b'}`;
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
