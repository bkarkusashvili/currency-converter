import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../lib';
import { CHART, type ChartDay, type RateHistorySeries } from '../lib/rateHistorySeries';

interface RateHistoryChartProps {
  series: RateHistorySeries;
  /** The window the series was asked for, which is what its label names. */
  days: number;
  /** The day the reader is on, from the pointer or the keyboard; null when they are on none. */
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
  /** The panel's summary line, which describes the picture this draws. */
  describedBy: string;
}

const TOOLTIP = { width: 172, height: 40, top: 8, padding: 12 } as const;
const WIPE_ID = 'rate-history-wipe';
const MIN_LABEL_BELOW = 16;
const MAX_LABEL_ABOVE = 7;

/**
 * The series as a picture: a band between buy and sell with a line on each
 * edge, or one line where the pair is quoted as a single mid rate. Three grid
 * lines, the low, the high and the latest marked, and the day under the cursor
 * called out in a tooltip (§3.20).
 *
 * The SVG itself is `role="img"` with the summary as its description — a
 * screen reader is told what the picture shows and is then handed the table
 * below, which is the same data in a form it can read row by row. What it must
 * not be handed is 90 unlabelled shapes.
 *
 * The days are still reachable one at a time, but as real buttons in a strip
 * over the plot rather than as focusable SVG groups: a `<button>` is focusable,
 * nameable and describable on every platform, and laying them out in percent
 * keeps them over their points at whatever width the chart is drawn.
 */
export function RateHistoryChart({
  series,
  days,
  activeIndex,
  onActivate,
  describedBy,
}: RateHistoryChartProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = activeIndex === null ? null : (series.days[activeIndex] ?? null);
  const hasSpread = series.kind === 'spread';
  const tooltipId = 'rate-history-tooltip';

  function move(to: number) {
    const index = Math.min(Math.max(to, 0), series.days.length - 1);
    onActivate(index);
    buttons.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = series.days.length - 1;
    const step = { ArrowLeft: -1, ArrowRight: 1 };

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(index + step[event.key]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(last);
    } else if (event.key === 'Escape') {
      onActivate(null);
      buttons.current[index]?.blur();
    }
  }

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        onActivate(null);
      }}
    >
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        width="100%"
        role="img"
        aria-label={t(hasSpread ? 'rateHistory.chartLabelSpread' : 'rateHistory.chartLabelCross', {
          days,
        })}
        aria-describedby={describedBy}
        className="block overflow-visible font-mono"
      >
        <g className="stroke-line" strokeWidth="1">
          {series.ticks.map((tick) => (
            <line key={tick.y} x1={CHART.left} y1={tick.y} x2={CHART.right} y2={tick.y} />
          ))}
        </g>
        <g className="fill-faint" fontSize="10" textAnchor="end">
          {series.ticks.map((tick) => (
            <text key={tick.y} x={CHART.left - 6} y={tick.y + 3}>
              {formatters.rate(tick.value)}
            </text>
          ))}
        </g>

        {/* The clip is keyed by the window, so switching the range remounts it
            and the lines are drawn across again — 320ms, and nothing at all
            under reduced motion. */}
        <defs>
          <clipPath id={WIPE_ID}>
            <rect
              key={days}
              className="chart-wipe"
              x={CHART.left - 4}
              y="0"
              width={CHART.right - CHART.left + 8}
              height={CHART.height}
            />
          </clipPath>
        </defs>

        <g clipPath={`url(#${WIPE_ID})`}>
          {series.spread !== '' && <polygon points={series.spread} className="fill-accent-soft" />}

          {series.sellLine !== '' && (
            <polyline
              points={series.sellLine}
              fill="none"
              className="stroke-muted"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {series.line !== '' && (
            <polyline
              points={series.line}
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </g>

        {!series.min.absorbed && (
          <>
            <circle
              cx={series.min.x}
              cy={series.min.y}
              r="3.5"
              className="fill-raised stroke-accent"
              strokeWidth="1.5"
            />
            <text
              x={series.min.x}
              y={series.min.y + MIN_LABEL_BELOW}
              fontSize="10"
              textAnchor="middle"
              className="fill-faint"
            >
              {t('rateHistory.marker.min', { value: formatters.rate(series.min.value) })}
            </text>
          </>
        )}
        {!series.max.absorbed && (
          <>
            <circle
              cx={series.max.x}
              cy={series.max.y}
              r="3.5"
              className={`fill-raised ${hasSpread ? 'stroke-muted' : 'stroke-accent'}`}
              strokeWidth="1.5"
            />
            <text
              x={series.max.x}
              y={series.max.y - MAX_LABEL_ABOVE}
              fontSize="10"
              textAnchor="end"
              className="fill-faint"
            >
              {t('rateHistory.marker.max', { value: formatters.rate(series.max.value) })}
            </text>
          </>
        )}

        <circle cx={series.latest.x} cy={series.latest.y} r="4" className="fill-accent" />
        <text
          x={series.latest.labelX}
          y={series.latest.labelY}
          fontSize="11"
          fontWeight="600"
          textAnchor={series.latest.anchor}
          className="fill-ink"
        >
          {t(LATEST_KEY[series.latest.note ?? 'none'], {
            value: formatters.rate(series.latest.value),
          })}
        </text>

        {active !== null && (
          <g>
            <line
              x1={active.x}
              y1={CHART.top}
              x2={active.x}
              y2={CHART.bottom}
              className="stroke-line-strong"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {active.sellY !== null && (
              <circle
                cx={active.x}
                cy={active.sellY}
                r="4"
                className="fill-raised stroke-muted"
                strokeWidth="2"
              />
            )}
            <circle
              cx={active.x}
              cy={active.y}
              r="4"
              className="fill-raised stroke-accent"
              strokeWidth="2"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="8"
              fill="none"
              className="stroke-accent"
              strokeWidth="2"
              opacity="0.5"
            />
            <rect
              x={tooltipX(active.x)}
              y={TOOLTIP.top}
              width={TOOLTIP.width}
              height={TOOLTIP.height}
              rx="6"
              className="fill-raised stroke-line dark:stroke-line-strong"
            />
            <text
              x={tooltipX(active.x) + TOOLTIP.padding}
              y={TOOLTIP.top + 16}
              fontSize="10"
              className="fill-muted"
            >
              {formatters.archivedDay(active.date, 'full')}
            </text>
            <text
              id={tooltipId}
              x={tooltipX(active.x) + TOOLTIP.padding}
              y={TOOLTIP.top + 31}
              fontSize="11"
              className="fill-ink"
            >
              {values(active)}
            </text>
          </g>
        )}

        <g className="fill-faint" fontSize="10">
          {series.labels.map((label) => (
            <text key={label.index} x={label.x} y={CHART.labelBaseline} textAnchor={label.anchor}>
              {formatters.archivedDay(label.date, label.withMonth ? 'dayMonth' : 'day')}
            </text>
          ))}
        </g>
      </svg>

      {/* One target per day over the plot: the tooltip follows the pointer, and
          ← → Home End walk the series for a keyboard. Only the day in hand is
          in the tab order, so a 90-day window is one stop and not ninety. */}
      <div
        role="group"
        aria-label={t('rateHistory.heading')}
        className="absolute inset-x-0 top-[28%] flex h-[60%]"
      >
        {series.days.map((day) => (
          <button
            key={day.date}
            type="button"
            ref={(element) => {
              buttons.current[day.index] = element;
            }}
            tabIndex={day.index === (activeIndex ?? 0) ? 0 : -1}
            aria-label={formatters.archivedDay(day.date, 'full') ?? day.date}
            aria-describedby={day.index === activeIndex ? tooltipId : undefined}
            className="absolute top-0 h-full rounded-sm"
            style={{ left: `${String(day.band.left)}%`, width: `${String(day.band.width)}%` }}
            onFocus={() => {
              onActivate(day.index);
            }}
            onMouseEnter={() => {
              onActivate(day.index);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, day.index);
            }}
          />
        ))}
      </div>
    </div>
  );

  function values(day: ChartDay): string {
    return day.sell === null
      ? t('rateHistory.tooltipCross', { cross: formatters.rate(day.value) })
      : t('rateHistory.tooltipValues', {
          buy: formatters.rate(day.value),
          sell: formatters.rate(day.sell),
        });
  }
}

/** The latest value absorbs the low or the high when it is one of them (board 3b). */
const LATEST_KEY = {
  min: 'rateHistory.marker.latestMin',
  max: 'rateHistory.marker.latestMax',
  none: 'rateHistory.marker.latest',
} as const;

/** Centred over the day, then pushed back inside the plot rather than off it. */
function tooltipX(x: number): number {
  const centred = x - TOOLTIP.width / 2;

  return Math.min(Math.max(centred, CHART.left), CHART.right - TOOLTIP.width);
}
