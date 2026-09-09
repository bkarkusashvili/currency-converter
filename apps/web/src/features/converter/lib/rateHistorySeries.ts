import type { RateHistoryPoint } from '../../../api';

/**
 * The chart's geometry, in the coordinates of its `viewBox 0 0 400 200`
 * (§3.20). The plot is `x 40 → 388` and `y 56 → 176`: 40 on the left for the
 * value labels, 24 at the bottom for the day labels, and the band above the
 * plot reserved for the tooltip, which is why the plot starts at 56 rather
 * than at the 8 the board's annotation names (§6.12).
 */
export const CHART = {
  width: 400,
  height: 200,
  left: 40,
  right: 388,
  top: 56,
  bottom: 176,
  /** The middle grid line, which the scale is centred on. */
  midY: 120,
  /** The distance between two grid lines, and so between two ticks. */
  tickGap: 48,
  /** The baseline the day labels sit on, below the plot. */
  labelBaseline: 196,
} as const;

/** Room for the min/max markers, whose circles have `r 3.5`, inside the plot. */
const MARKER_ROOM = 4;

/**
 * The tick steps a reader can divide by. `3` earns its place beside the usual
 * 1 · 2 · 2.5 · 5: without it a 0.64-wide series either wastes half the plot
 * on a 0.5 step or overflows it on 0.25.
 */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];

/** How many magnitudes above the series' own the search may climb before it stops. */
const MAGNITUDES = 8;

/** A flat series still needs a scale; this is the span it is given, relative to its value. */
const FLAT_SPAN = 0.002;

/** Day-label cadence: every second day over a week, weekly over a month, monthly beyond it. */
const LABEL_CADENCE = [
  { upTo: 8, every: 2 },
  { upTo: 31, every: 7 },
] as const;

const MONTHLY_CADENCE = 30;

export type SeriesKind = 'spread' | 'cross';

export interface ChartDay {
  index: number;
  /** The archived UTC day, `YYYY-MM-DD`. */
  date: string;
  /** The series the chart draws in the accent colour: `buy`, or `cross` where there is no spread. */
  value: number;
  /** The upper line of a spread pair; null when the pair is quoted as one mid rate. */
  sell: number | null;
  x: number;
  y: number;
  sellY: number | null;
  /** How `value` moved since the day before. Null on the first day, which has no day before it. */
  change: number | null;
  /** The slice of the chart's width this day owns, as percentages, for the hit target over it. */
  band: { left: number; width: number };
}

export interface ChartTick {
  value: number;
  y: number;
}

export interface ChartMarker {
  index: number;
  x: number;
  y: number;
  value: number;
  /** Which line the marker sits on, and so which colour it is stroked in. */
  series: 'value' | 'sell';
  /** The latest point is this one, and draws it: two circles on one point is one too many. */
  absorbed: boolean;
}

export interface ChartLatest {
  x: number;
  y: number;
  value: number;
  /** Set when the last day is also the series' low or high, whose marker it then absorbs. */
  note: 'min' | 'max' | null;
  anchor: 'start' | 'end';
  labelX: number;
  labelY: number;
}

export interface ChartLabel {
  index: number;
  date: string;
  x: number;
  anchor: 'middle' | 'end';
  /** The first, the last, and any day that opens a new month, carry the month's name. */
  withMonth: boolean;
}

export interface SeriesChange {
  direction: 'up' | 'down' | 'flat';
  /** The size of the move as a proportion of where it started; never negative. */
  magnitude: number;
  first: number;
  last: number;
}

export interface RateHistorySeries {
  kind: SeriesKind;
  days: ChartDay[];
  /** `points` for the accent line. Empty for a single day, which is a dot and not a line. */
  line: string;
  sellLine: string;
  /** `points` for the band between the two lines; empty unless the pair has a spread. */
  spread: string;
  ticks: ChartTick[];
  min: ChartMarker;
  max: ChartMarker;
  latest: ChartLatest;
  labels: ChartLabel[];
  change: SeriesChange;
}

interface Reading {
  date: string;
  value: number;
  sell: number | null;
}

interface Scale {
  step: number;
  centre: number;
  /** Pixels per unit of value. */
  perUnit: number;
}

/**
 * Everything the chart draws, computed from the archived series and nothing
 * else — no DOM, no locale, no theme. The component places these numbers and
 * formats them; what shape the series has, where each day sits and which day
 * is the low, the high and the latest is decided here, where it can be read
 * off a fixture.
 *
 * Null when there is nothing to draw: no points, or points carrying no rate
 * for this pair at all.
 */
export function buildRateHistorySeries(
  points: readonly RateHistoryPoint[],
): RateHistorySeries | null {
  const readings = toReadings(points);
  if (readings.length === 0) {
    return null;
  }

  // One missing `sell` is enough to drop the band: a spread drawn across a day
  // that has no sell is a shape invented for a gap the archive is careful to
  // leave visible.
  const kind: SeriesKind = readings.every((reading) => reading.sell !== null) ? 'spread' : 'cross';
  const values = readings.flatMap((reading) =>
    kind === 'spread' && reading.sell !== null ? [reading.value, reading.sell] : [reading.value],
  );
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const scale = chooseScale(lo, hi);
  const y = (value: number) => round2(CHART.midY - (value - scale.centre) * scale.perUnit);

  const days = readings.map((reading, index) => {
    const previous = readings[index - 1];

    return {
      index,
      date: reading.date,
      value: reading.value,
      sell: kind === 'spread' ? reading.sell : null,
      x: xOf(index, readings.length),
      y: y(reading.value),
      sellY: kind === 'spread' && reading.sell !== null ? y(reading.sell) : null,
      change: previous === undefined ? null : round(reading.value - previous.value, 6),
      band: bandOf(index, readings.length),
    } satisfies ChartDay;
  });

  const last = days.length - 1;
  const min = extreme(days, 'value', 'min', last);
  const max =
    kind === 'spread' ? extreme(days, 'sell', 'max', last) : extreme(days, 'value', 'max', last);
  const latest = latestOf(days, min, max);

  return {
    kind,
    days,
    line: polyline(days, (day) => day.y),
    sellLine: kind === 'spread' ? polyline(days, (day) => day.sellY) : '',
    spread: kind === 'spread' ? spreadBand(days) : '',
    ticks: [scale.centre + scale.step, scale.centre, scale.centre - scale.step].map((value) => ({
      value: round(value, 10),
      y: y(value),
    })),
    min,
    max,
    latest,
    labels: labelsOf(days),
    change: changeOf(days),
  };
}

/**
 * A point carries `buy` and `sell`, or `cross`, on the same terms as a
 * snapshot row. One carrying neither is a day this client cannot draw, and
 * dropping it leaves the gap the archive already means by leaving the day out.
 */
function toReadings(points: readonly RateHistoryPoint[]): Reading[] {
  return points.flatMap((point) => {
    const value = point.buy ?? point.cross;
    if (value === undefined || !Number.isFinite(value)) {
      return [];
    }

    const sell = point.sell !== undefined && Number.isFinite(point.sell) ? point.sell : null;
    return [{ date: point.date, value, sell }];
  });
}

/**
 * The scale is the tick step: three "nice" ticks 48px apart, centred on the
 * middle grid line, and the smallest step that still fits the whole series
 * inside the plot. Searching for it rather than solving for it is what lets
 * the centre be rounded to a number worth reading — 44.50 rather than 44.51 —
 * without the rounding pushing a point out of the plot.
 */
function chooseScale(lo: number, hi: number): Scale {
  const mid = (lo + hi) / 2;
  // A flat series has no span of its own to size a step from, so it borrows one
  // from its own magnitude; a series at zero borrows the smallest step there is.
  const base = Math.max(hi - lo, Math.abs(mid) * FLAT_SPAN, Number.EPSILON);
  const smallest = Math.floor(Math.log10(base)) - 1;
  let step = base;

  for (let magnitude = 0; magnitude < MAGNITUDES; magnitude += 1) {
    for (const factor of NICE_STEPS) {
      step = factor * 10 ** (smallest + magnitude);
      const perUnit = CHART.tickGap / step;
      const centre = centreFor(mid, step);

      if (
        CHART.midY - (hi - centre) * perUnit >= CHART.top + MARKER_ROOM &&
        CHART.midY - (lo - centre) * perUnit <= CHART.bottom - MARKER_ROOM
      ) {
        return { step, centre, perUnit };
      }
    }
  }

  return { step, centre: mid, perUnit: CHART.tickGap / step };
}

/**
 * The value the middle grid line carries: the series' own midpoint, rounded to
 * the step's last decimal place — but only while that rounding moves the chart
 * by less than a quarter of a tick, so a legible tick is never bought with a
 * visibly off-centre series.
 */
function centreFor(mid: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const rounded = round(mid, decimals);

  return Math.abs(rounded - mid) <= step / 4 ? rounded : mid;
}

/** A single day has no span to spread across, so it sits in the middle of the plot. */
function xOf(index: number, count: number): number {
  if (count === 1) {
    return round2((CHART.left + CHART.right) / 2);
  }

  return round2(CHART.left + ((CHART.right - CHART.left) * index) / (count - 1));
}

/**
 * The band a day answers to, halfway to each neighbour and out to the plot's
 * edge at the ends, as percentages of the chart's width — the hit target over
 * the chart is HTML, and the chart is drawn at whatever width it is given.
 */
function bandOf(index: number, count: number): { left: number; width: number } {
  const here = xOf(index, count);
  const start = index === 0 ? CHART.left : (xOf(index - 1, count) + here) / 2;
  const end = index === count - 1 ? CHART.right : (here + xOf(index + 1, count)) / 2;

  return {
    left: round2((start / CHART.width) * 100),
    width: round2(((end - start) / CHART.width) * 100),
  };
}

function polyline(days: readonly ChartDay[], at: (day: ChartDay) => number | null): string {
  if (days.length < 2) {
    return '';
  }

  return days
    .flatMap((day) => {
      const y = at(day);
      return y === null ? [] : [`${String(day.x)},${String(y)}`];
    })
    .join(' ');
}

/** The sell line left to right, then the buy line back, which closes the band between them. */
function spreadBand(days: readonly ChartDay[]): string {
  if (days.length < 2) {
    return '';
  }

  const upper = days.flatMap((day) =>
    day.sellY === null ? [] : [`${String(day.x)},${String(day.sellY)}`],
  );
  const lower = [...days].reverse().map((day) => `${String(day.x)},${String(day.y)}`);

  return [...upper, ...lower].join(' ');
}

/**
 * The lowest or highest day of one series. Ties resolve to the later day, so a
 * low that runs into the last day is reported as the last day — which is what
 * lets the latest marker absorb it instead of drawing two circles on one point.
 */
function extreme(
  days: readonly ChartDay[],
  series: 'value' | 'sell',
  edge: 'min' | 'max',
  last: number,
): ChartMarker {
  let best: ChartMarker | null = null;

  for (const day of days) {
    const value = series === 'sell' ? day.sell : day.value;
    const y = series === 'sell' ? day.sellY : day.y;
    if (value === null || y === null) {
      continue;
    }

    const better = best === null || (edge === 'min' ? value <= best.value : value >= best.value);
    if (better) {
      best = {
        index: day.index,
        x: day.x,
        y,
        value,
        series,
        // The latest marker is drawn on the accent line, so only a marker on
        // that line and on that day is the same circle (board 3b).
        absorbed: series === 'value' && day.index === last,
      };
    }
  }

  // Only reachable for a series with no drawable day, which `toReadings` has
  // already ruled out; the fallback keeps the type honest without a cast.
  return best ?? { index: 0, x: CHART.left, y: CHART.midY, value: 0, series, absorbed: false };
}

const LABEL_OFFSET = 8;
const LABEL_BELOW = 16;

function latestOf(days: readonly ChartDay[], min: ChartMarker, max: ChartMarker): ChartLatest {
  const last = days[days.length - 1] ?? {
    x: CHART.right,
    y: CHART.midY,
    value: 0,
    index: 0,
  };
  // At the left edge the label would run off the chart, so it flips to the
  // other side of the point; against the top it drops below it.
  const anchor = last.x - LABEL_OFFSET < CHART.left + LABEL_OFFSET ? 'start' : 'end';
  const labelY = last.y - LABEL_OFFSET;

  return {
    x: last.x,
    y: last.y,
    value: last.value,
    // Only a marker on the same line can be the same point: board 3a's high
    // is the sell of the latest day, and the latest buy is not it.
    note: min.absorbed ? 'min' : max.absorbed ? 'max' : null,
    anchor,
    labelX: anchor === 'end' ? last.x - LABEL_OFFSET : last.x + LABEL_OFFSET,
    labelY: labelY < CHART.top ? last.y + LABEL_BELOW : labelY,
  };
}

/**
 * Which days are named under the plot. The first and the last always are, and
 * between them one every second day, week or month depending on how many there
 * are — dropping any that would crowd the last one.
 */
function labelsOf(days: readonly ChartDay[]): ChartLabel[] {
  const count = days.length;
  const every = LABEL_CADENCE.find((rule) => count <= rule.upTo)?.every ?? MONTHLY_CADENCE;
  const last = count - 1;
  let previousMonth: string | null = null;

  return days
    .filter((day) => day.index === last || (day.index % every === 0 && last - day.index >= every))
    .map((day) => {
      const month = day.date.slice(0, 7);
      // A label that opens a new month says which, so a run of bare day
      // numbers never crosses a month boundary in silence.
      const withMonth = day.index === 0 || day.index === last || month !== previousMonth;
      previousMonth = month;

      // The last label hangs off the right edge of the plot, where the last
      // day is — unless it is also the first, and the day sits in the middle.
      const atRightEdge = day.index === last && count > 1;

      return {
        index: day.index,
        date: day.date,
        x: atRightEdge ? CHART.right + 4 : day.x,
        anchor: atRightEdge ? ('end' as const) : ('middle' as const),
        withMonth,
      };
    });
}

function changeOf(days: readonly ChartDay[]): SeriesChange {
  const first = days[0]?.value ?? 0;
  const last = days[days.length - 1]?.value ?? 0;
  const direction = last > first ? 'up' : last < first ? 'down' : 'flat';

  return {
    direction,
    magnitude: first === 0 ? 0 : Math.abs((last - first) / first),
    first,
    last,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function round2(value: number): number {
  return round(value, 2);
}
