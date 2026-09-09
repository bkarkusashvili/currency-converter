import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../lib';
import {
  CHART,
  labelWidth,
  placeLabel,
  placeLabelY,
  type ChartDay,
  type RateHistorySeries,
} from '../lib/rateHistorySeries';

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

/**
 * The two sets of sizes the chart draws at, in the units of its own viewBox.
 *
 * The picture is `width: 100%` over a 400×200 viewBox, so one font size renders
 * at a different number of CSS pixels for every width the panel is given: the
 * 10 units board 3a sets came out at 6.4 CSS px in the squeezed desktop column
 * this panel actually gets. Board 3d draws the phone at its own, larger set,
 * and both are here rather than in CSS because the tooltip's box and every
 * label's placement are computed from them (§3.20).
 */
interface ChartSizes {
  /** The grid's value labels, down the left. */
  tick: number;
  /** The dates under the axis. */
  day: number;
  /** The low's and the high's labels. */
  marker: number;
  /** The last day's value, the one number the picture is really for. */
  latest: number;
  cursor: { point: number; ring: number };
  tooltip: {
    width: number;
    height: number;
    top: number;
    padding: number;
    date: number;
    values: number;
  };
}

const SIZES: Record<'compact' | 'regular', ChartSizes> = {
  compact: {
    tick: 13,
    day: 13,
    marker: 13,
    latest: 14,
    cursor: { point: 5, ring: 9 },
    tooltip: { width: 192, height: 44, top: 6, padding: 12, date: 12, values: 13 },
  },
  regular: {
    tick: 10,
    day: 10,
    marker: 10,
    latest: 11,
    cursor: { point: 4, ring: 8 },
    tooltip: { width: 172, height: 40, top: 8, padding: 12, date: 10, values: 11 },
  },
};

/** How far off its point a side-anchored label is set (board 3a's latest value). */
const LABEL_GAP = 8;
const WIPE_ID = 'rate-history-wipe';

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
 *
 * Everything that carries text is drawn twice, once at each size, with exactly
 * one of the two `display: none` at any width — the same bargain the result
 * card's timestamp makes, and the reason nothing here has to measure the DOM.
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
  // Which day holds the tab stop. Normally the day being called out, but they
  // part on Escape: the tooltip goes and the focus stays where it was.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const active = activeIndex === null ? null : (series.days[activeIndex] ?? null);
  const hasSpread = series.kind === 'spread';
  const tooltipId = 'rate-history-tooltip';
  const roving = focusIndex ?? activeIndex ?? 0;
  const onlyDay = series.days.length === 1 ? series.days[0] : undefined;

  function values(day: ChartDay): string {
    return day.sell === null
      ? t('rateHistory.tooltipCross', { cross: formatters.rate(day.value) })
      : t('rateHistory.tooltipValues', {
          buy: formatters.rate(day.value),
          sell: formatters.rate(day.sell),
        });
  }

  function move(to: number) {
    const index = Math.min(Math.max(to, 0), series.days.length - 1);
    setFocusIndex(index);
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
      // Dismisses the tooltip and leaves the focus where it is: taking the
      // focus to `<body>` is a bigger answer than the key was asking for, and
      // it loses the reader their place in the series.
      setFocusIndex(index);
      onActivate(null);
    }
  }

  const latestText = t(LATEST_KEY[series.latest.note ?? 'none'], {
    value: formatters.rate(series.latest.value),
  });

  function text(sizes: ChartSizes, className: string) {
    return (
      <g className={className}>
        <g className="fill-faint" fontSize={sizes.tick} textAnchor="end">
          {series.ticks.map((tick) => (
            <text key={tick.y} x={CHART.left - 6} y={tick.y + sizes.tick * 0.3}>
              {formatters.rate(tick.value)}
            </text>
          ))}
        </g>

        {series.min !== null && !series.min.absorbed && (
          <MarkerLabel
            fontSize={sizes.marker}
            marker={series.min}
            prefer="middle"
            side="below"
            text={t('rateHistory.marker.min', { value: formatters.rate(series.min.value) })}
          />
        )}
        {series.max !== null && !series.max.absorbed && (
          <MarkerLabel
            fontSize={sizes.marker}
            marker={series.max}
            prefer="end"
            side="above"
            text={t('rateHistory.marker.max', { value: formatters.rate(series.max.value) })}
          />
        )}

        <Latest fontSize={sizes.latest} latest={series.latest} text={latestText} />

        {active !== null && (
          <g aria-hidden="true">
            <rect
              x={tooltipX(active.x, sizes.tooltip.width)}
              y={sizes.tooltip.top}
              width={sizes.tooltip.width}
              height={sizes.tooltip.height}
              rx="6"
              className="fill-raised stroke-line dark:stroke-line-strong"
            />
            <text
              x={tooltipX(active.x, sizes.tooltip.width) + sizes.tooltip.padding}
              y={sizes.tooltip.top + sizes.tooltip.height * 0.41}
              fontSize={sizes.tooltip.date}
              className="fill-muted"
            >
              {formatters.archivedDay(active.date, 'full')}
            </text>
            <text
              x={tooltipX(active.x, sizes.tooltip.width) + sizes.tooltip.padding}
              y={sizes.tooltip.top + sizes.tooltip.height * 0.8}
              fontSize={sizes.tooltip.values}
              className="fill-ink"
            >
              {values(active)}
            </text>
          </g>
        )}

        <g className="fill-faint" fontSize={sizes.day}>
          {series.labels.map((label) => (
            <text key={label.index} x={label.x} y={CHART.labelBaseline} textAnchor={label.anchor}>
              {formatters.archivedDay(label.date, label.withMonth ? 'dayMonth' : 'day')}
            </text>
          ))}
        </g>
      </g>
    );
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

          {/* 2.5 rather than 2 on a phone, where the picture is drawn at 0.7 of
              its own units, and in dark, where a 2-unit line on a dark ground
              reads thinner than the same line on a light one (§3.20). */}
          {series.sellLine !== '' && (
            <polyline
              points={series.sellLine}
              fill="none"
              className="stroke-muted [stroke-width:2] max-sm:[stroke-width:2.5] dark:[stroke-width:2.5]"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {series.line !== '' && (
            <polyline
              points={series.line}
              fill="none"
              className="stroke-accent [stroke-width:2] max-sm:[stroke-width:2.5] dark:[stroke-width:2.5]"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </g>

        {series.min !== null && !series.min.absorbed && (
          <circle
            cx={series.min.x}
            cy={series.min.y}
            r="3.5"
            className="fill-raised stroke-accent"
            strokeWidth="1.5"
          />
        )}
        {series.max !== null && !series.max.absorbed && (
          <circle
            cx={series.max.x}
            cy={series.max.y}
            r="3.5"
            className={`fill-raised ${hasSpread ? 'stroke-muted' : 'stroke-accent'}`}
            strokeWidth="1.5"
          />
        )}
        <circle cx={series.latest.x} cy={series.latest.y} r="4" className="fill-accent" />
        {/* One archived day has no sell *line* to carry its sell rate, and no
            high to mark it as either. Drawn as a plain point, so the picture
            holds both of the day's readings the table below it lists and the
            legend is not naming a line nobody can see. */}
        {onlyDay?.sellY != null && (
          <circle
            cx={onlyDay.x}
            cy={onlyDay.sellY}
            r="3.5"
            className="fill-raised stroke-muted"
            strokeWidth="1.5"
          />
        )}

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
            <Cursor day={active} />
          </g>
        )}

        {text(SIZES.compact, 'sm:hidden')}
        {text(SIZES.regular, 'hidden sm:inline')}
      </svg>

      {/* The tooltip's sentence, once, outside the picture. Inside it, it would
          be a description pointing into a subtree that is already `role="img"`
          and so presentational — a string some readers announce and others
          skip. Here it is a plain element every one of them reads. */}
      <span id={tooltipId} className="sr-only">
        {active === null ? '' : values(active)}
      </span>

      {/* One target per day over the plot: the tooltip follows the pointer, and
          ← → Home End walk the series for a keyboard. Only the day in hand is
          in the tab order, so a 90-day window is one stop and not ninety. */}
      <div
        role="group"
        aria-label={t('rateHistory.dayStrip')}
        className="absolute inset-x-0 top-[28%] flex h-[60%]"
      >
        {series.days.map((day) => (
          <button
            key={day.date}
            type="button"
            ref={(element) => {
              buttons.current[day.index] = element;
            }}
            tabIndex={day.index === roving ? 0 : -1}
            aria-label={formatters.archivedDay(day.date, 'full') ?? day.date}
            aria-describedby={day.index === activeIndex ? tooltipId : undefined}
            className="absolute top-0 h-full rounded-sm"
            style={{ left: `${String(day.band.left)}%`, width: `${String(day.band.width)}%` }}
            onFocus={() => {
              setFocusIndex(day.index);
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
}

/** The latest value absorbs the low or the high when it is one of them (board 3b). */
const LATEST_KEY = {
  min: 'rateHistory.marker.latestMin',
  max: 'rateHistory.marker.latestMax',
  none: 'rateHistory.marker.latest',
} as const;

/** Centred over the day, then pushed back inside the plot rather than off it. */
function tooltipX(x: number, width: number): number {
  const centred = x - width / 2;

  return Math.min(Math.max(centred, CHART.left), CHART.right - width);
}

interface MarkerLabelProps {
  marker: { x: number; y: number };
  text: string;
  fontSize: number;
  /** Where the label sits when there is room for it there. */
  prefer: 'middle' | 'end';
  side: 'above' | 'below';
}

/** The low's and the high's labels, both placed by the one shared rule. */
function MarkerLabel({ marker, text, fontSize, prefer, side }: MarkerLabelProps) {
  const { x, anchor } = placeLabel(marker.x, labelWidth(text, fontSize), prefer);

  return (
    <text
      x={x}
      y={placeLabelY(marker.y, side, fontSize)}
      fontSize={fontSize}
      textAnchor={anchor}
      className="fill-faint"
    >
      {text}
    </text>
  );
}

/** The last day's value, set beside its point by the same rule. */
function Latest({
  latest,
  text,
  fontSize,
}: {
  latest: { x: number; y: number };
  text: string;
  fontSize: number;
}) {
  const { x, anchor } = placeLabel(latest.x, labelWidth(text, fontSize), 'end', LABEL_GAP);

  return (
    <text
      x={x}
      y={placeLabelY(latest.y, 'above', fontSize)}
      fontSize={fontSize}
      fontWeight="600"
      textAnchor={anchor}
      className="fill-ink"
    >
      {text}
    </text>
  );
}

/** The two circles and the ring on the day the reader is on. */
function Cursor({ day }: { day: ChartDay }) {
  const rings = [
    { className: 'sm:hidden', size: SIZES.compact.cursor },
    { className: 'hidden sm:inline', size: SIZES.regular.cursor },
  ];

  return (
    <>
      {rings.map(({ className, size }) => (
        <g key={className} className={className}>
          {day.sellY !== null && (
            <circle
              cx={day.x}
              cy={day.sellY}
              r={size.point}
              className="fill-raised stroke-muted"
              strokeWidth="2"
            />
          )}
          <circle
            cx={day.x}
            cy={day.y}
            r={size.point}
            className="fill-raised stroke-accent"
            strokeWidth="2"
          />
          <circle
            cx={day.x}
            cy={day.y}
            r={size.ring}
            fill="none"
            className="stroke-accent"
            strokeWidth="2"
            opacity="0.5"
          />
        </g>
      ))}
    </>
  );
}
