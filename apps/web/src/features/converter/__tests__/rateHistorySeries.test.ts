import { describe, expect, it } from 'vitest';
import type { RateHistoryPoint } from '../../../api';
import { FAKE_RESPONSES } from '../../../test/fakes/createFakeServices';
import {
  buildRateHistorySeries,
  CHART,
  labelWidth,
  placeLabel,
  placeLabelY,
} from '../lib/rateHistorySeries';

/**
 * The seven archived days board 3a is drawn from, which is also the fixture
 * the panel's suite renders. The board publishes the geometry it produced —
 * grid values, both polylines, the markers — so this suite can check the
 * arithmetic against a drawing rather than against itself.
 */
const week = FAKE_RESPONSES.rateHistory.points;

/** Board 3a's own buy polyline, `points` attribute and all. */
const BOARD_BUY = '40,166.4 98,155.2 156,169.6 214,160 272,147.2 330,152 388,144';
const BOARD_SELL = '40,88 98,78.4 156,91.2 214,81.6 272,70.4 330,73.6 388,67.2';

function build(points: RateHistoryPoint[]) {
  const series = buildRateHistorySeries(points);
  if (series === null) {
    throw new Error('the fixture produced no series');
  }

  return series;
}

describe('buildRateHistorySeries', () => {
  it('places the week board 3a draws exactly where the board draws it', () => {
    const series = build([...week]);

    expect(series.kind).toBe('spread');
    expect(series.ticks.map((tick) => tick.value)).toEqual([44.8, 44.5, 44.2]);
    expect(series.ticks.map((tick) => tick.y)).toEqual([72, 120, 168]);
    expect(series.line).toBe(BOARD_BUY);
    expect(series.sellLine).toBe(BOARD_SELL);
    // The band is the sell line out and the buy line back, which closes it.
    expect(series.spread).toBe(`${BOARD_SELL} ${[...BOARD_BUY.split(' ')].reverse().join(' ')}`);
  });

  it('marks the low of the buy line and the high of the sell line', () => {
    const series = build([...week]);

    expect(series.min).toMatchObject({ value: 44.19, x: 156, y: 169.6, series: 'value' });
    expect(series.max).toMatchObject({ value: 44.83, x: 388, y: 67.2, series: 'sell' });
    expect(series.latest).toMatchObject({ value: 44.35, x: 388, y: 144, note: null });
    // The high is the sell of the latest day, which is not the latest point:
    // both circles are drawn, on their own lines.
    expect([series.min?.absorbed, series.max?.absorbed]).toEqual([false, false]);
  });

  it('lets the latest point absorb the marker when it is itself the low', () => {
    const falling = week.map((point, index) => ({ ...point, buy: 44.4 - index / 100 }));
    const series = build(falling);

    expect(series.min?.index).toBe(falling.length - 1);
    expect(series.latest.note).toBe('min');
  });

  it('reads the change off the first and last day', () => {
    const series = build([...week]);

    expect(series.change).toMatchObject({ direction: 'up', first: 44.21, last: 44.35 });
    // 44.21 → 44.35 is 0.3167%, which the panel renders to one place as 0.3%.
    expect(series.change.magnitude).toBeCloseTo(0.003167, 6);
  });

  it('reports a series that ends where it started as unchanged', () => {
    const flat = week.map((point) => ({ ...point, buy: 44.3, sell: 44.8 }));
    const series = build(flat);

    expect(series.change).toMatchObject({ direction: 'flat', magnitude: 0 });
    // A rate that never moved is a straight line, and both of its lines are
    // still inside the plot rather than on top of each other.
    expect(new Set(series.days.map((day) => day.y)).size).toBe(1);
    expect(new Set(series.days.map((day) => day.sellY)).size).toBe(1);
    expect(series.days[0]?.y).toBeGreaterThan(series.days[0]?.sellY ?? 0);
  });

  it('has no low and no high where every day carries the same rate', () => {
    const flat = week.map((point) => ({ ...point, buy: 44.3, sell: 44.8 }));
    const series = build(flat);

    // Seven days at one rate: the fourth is not lower than the third, and
    // pointing at one of them as the low says a shape the archive never had.
    expect(series.min).toBeNull();
    expect(series.max).toBeNull();
    expect(series.latest.note).toBeNull();
  });

  it('marks the line that moved and leaves the one that did not alone', () => {
    // Buy walks; sell is pinned. The low of the buy line is real, the high of
    // the sell line is every day of it at once.
    const oneSided = week.map((point, index) => ({
      ...point,
      buy: 44.2 + index / 100,
      sell: 44.8,
    }));
    const series = build(oneSided);

    expect(series.min).toMatchObject({ value: 44.2, series: 'value' });
    expect(series.max).toBeNull();
  });

  it('reports a falling series as down', () => {
    const series = build(
      [...week]
        .reverse()
        .map((point, index) => ({ ...point, date: `2026-09-0${String(index + 1)}` })),
    );

    expect(series.change.direction).toBe('down');
  });

  it('draws one day as a point in the middle of the plot rather than as a line', () => {
    const series = build([{ date: '2026-09-09', buy: 44.35, sell: 44.83 }]);

    expect(series.days).toHaveLength(1);
    expect(series.days[0]?.x).toBe((CHART.left + CHART.right) / 2);
    expect(series.line).toBe('');
    expect(series.sellLine).toBe('');
    expect(series.spread).toBe('');
    expect(series.change).toMatchObject({ direction: 'flat', first: 44.35, last: 44.35 });
    expect(series.labels).toEqual([
      expect.objectContaining({ anchor: 'middle', x: (CHART.left + CHART.right) / 2 }),
    ]);
  });

  it('calls one archived day neither a low nor a high, and says nothing beside it', () => {
    // What the live archive holds today. A single day is not lower or higher
    // than anything: it was drawn `44.35 · min` with `max 44.83` above it,
    // which reads as a week that happened to be flat rather than as one day.
    const series = build([{ date: '2026-09-09', buy: 44.35, sell: 44.83 }]);

    expect(series.min).toBeNull();
    expect(series.max).toBeNull();
    expect(series.latest).toMatchObject({ value: 44.35, note: null });

    // The same for a pair quoted as one cross rate.
    const cross = build([{ date: '2026-09-09', cross: 0.850512 }]);
    expect([cross.min, cross.max, cross.latest.note]).toEqual([null, null, null]);
  });

  it('draws two days as a line between the two edges of the plot', () => {
    const series = build([
      { date: '2026-09-08', buy: 44.3, sell: 44.79 },
      { date: '2026-09-09', buy: 44.35, sell: 44.83 },
    ]);

    expect(series.days.map((day) => day.x)).toEqual([CHART.left, CHART.right]);
    expect(series.days.map((day) => day.change)).toEqual([null, 0.05]);
    expect(series.line.split(' ')).toHaveLength(2);
  });

  it('keeps every point inside the plot however narrow or wide the series is', () => {
    const wide = [
      { date: '2026-09-07', cross: 0.2 },
      { date: '2026-09-08', cross: 940.5 },
      { date: '2026-09-09', cross: 61.75 },
    ];
    const narrow = [
      { date: '2026-09-07', cross: 0.850512 },
      { date: '2026-09-08', cross: 0.85143 },
      { date: '2026-09-09', cross: 0.851012 },
    ];

    for (const points of [wide, narrow]) {
      const series = build(points);

      for (const day of series.days) {
        expect(day.y).toBeGreaterThanOrEqual(CHART.top);
        expect(day.y).toBeLessThanOrEqual(CHART.bottom);
      }
    }
  });

  it('drops the band as soon as one day has no sell to draw it to', () => {
    const gappy = week.map((point, index) =>
      index === 3 ? { date: point.date, buy: 44.25 } : point,
    );
    const series = build(gappy);

    expect(series.kind).toBe('cross');
    expect(series.spread).toBe('');
    expect(series.sellLine).toBe('');
    expect(series.days.every((day) => day.sell === null)).toBe(true);
  });

  it('charts a cross pair as one line and marks both its ends', () => {
    const series = build([
      { date: '2026-09-07', cross: 0.851012 },
      { date: '2026-09-08', cross: 0.85143 },
      { date: '2026-09-09', cross: 0.850512 },
    ]);

    expect(series.kind).toBe('cross');
    expect(series.min).toMatchObject({ value: 0.850512, series: 'value' });
    expect(series.max).toMatchObject({ value: 0.85143, series: 'value' });
    expect(series.min?.absorbed).toBe(true);
    expect(series.latest.note).toBe('min');
  });

  it('leaves out a day the archive has no rate for at all', () => {
    const series = build([{ date: '2026-09-08' }, { date: '2026-09-09', buy: 44.35, sell: 44.83 }]);

    expect(series.days).toHaveLength(1);
    expect(series.days[0]?.date).toBe('2026-09-09');
  });

  it('has nothing to draw for an empty window', () => {
    expect(buildRateHistorySeries([])).toBeNull();
    expect(buildRateHistorySeries([{ date: '2026-09-09' }])).toBeNull();
  });

  it('names every second day over a week, always the first and the last', () => {
    const series = build([...week]);

    expect(series.labels.map((label) => label.index)).toEqual([0, 2, 4, 6]);
    expect(series.labels.map((label) => label.withMonth)).toEqual([true, false, false, true]);
    expect(series.labels.at(-1)).toMatchObject({ anchor: 'end', x: CHART.right + 4 });
  });

  it('names one day a week over a month, and the day a new month opens', () => {
    const month = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 11 + index)).toISOString().slice(0, 10),
      cross: 0.85 + index / 10_000,
    }));
    const series = build(month);

    // Board 3b: 11 Aug · 18 · 25 · 1 Sep · 9 Sep — the fifth is a label because
    // it is the last, the fourth because it opens September.
    expect(series.labels.map((label) => label.index)).toEqual([0, 7, 14, 21, 29]);
    expect(series.labels.map((label) => label.withMonth)).toEqual([true, false, false, true, true]);
  });

  it('gives every day a band of the plot to be reached by, and no more', () => {
    const series = build([...week]);
    const first = series.days[0]?.band;
    const last = series.days.at(-1)?.band;

    expect(first?.left).toBe((CHART.left / CHART.width) * 100);
    expect((last?.left ?? 0) + (last?.width ?? 0)).toBeCloseTo(
      (CHART.right / CHART.width) * 100,
      6,
    );
    const covered = series.days.reduce((total, day) => total + day.band.width, 0);
    expect(covered).toBeCloseTo(((CHART.right - CHART.left) / CHART.width) * 100, 6);
  });

  it('names one day a month over a quarter, without a two-month hole in it', () => {
    const quarter = Array.from({ length: 90 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 5, 12 + index)).toISOString().slice(0, 10),
      cross: 0.85 + index / 10_000,
    }));
    const series = build(quarter);

    // Counting days dropped index 60 for being 29 short of a 30-day cadence,
    // and left `12 Jun · 12 Jul · 9 Sep`. It is 113 units clear of the last
    // label, which is what the guard now measures.
    expect(series.labels.map((label) => label.index)).toEqual([0, 30, 60, 89]);
    expect(series.labels.map((label) => label.date)).toEqual([
      '2026-06-12',
      '2026-07-12',
      '2026-08-11',
      '2026-09-09',
    ]);
  });
});

describe('placeLabel', () => {
  it('leaves a label alone when it fits where the design puts it', () => {
    expect(placeLabel(CHART.right, labelWidth('44.35', 11), 'end', 8)).toEqual({
      x: 380,
      anchor: 'end',
    });
    expect(placeLabel(200, labelWidth('min 44.19', 10), 'middle')).toEqual({
      x: 200,
      anchor: 'middle',
    });
  });

  it('flips a label that would run off the left of the picture', () => {
    // The high of a series whose high is its first day: anchored `end` at the
    // left-hand edge of the plot, `max 44.83` starts at x = -14.
    const width = labelWidth('max 44.83', 10);
    expect(placeLabel(CHART.left, width, 'end')).toEqual({ x: CHART.left, anchor: 'start' });
    expect(CHART.left - width).toBeLessThan(0);
  });

  it('flips a centred label that would run off the right', () => {
    expect(placeLabel(CHART.right, labelWidth('min 44.19', 13), 'middle')).toEqual({
      x: CHART.right,
      anchor: 'end',
    });
  });

  it('pins a label too wide for the picture to its left edge rather than off it', () => {
    const width = CHART.width + 40;
    const placed = placeLabel(CHART.right, width, 'end', 8);

    // Nothing this wide fits either way; what it must not do is start off the
    // left of the picture, where the first characters would be the ones lost.
    expect(placed.anchor).toBe('end');
    expect(placed.x - width).toBe(0);
  });
});

describe('placeLabelY', () => {
  it('sets the low of board 3a above its point rather than over the day labels', () => {
    // 169.6 + 16 puts the baseline 2.4 units inside the row the dates are set
    // on, which is the overlap that was shipped.
    expect(169.6 + 16).toBeGreaterThan(CHART.labelBaseline - 8.5 - 2.5);
    expect(placeLabelY(169.6, 'below', 10)).toBeLessThan(169.6);
  });

  it('keeps a low well clear of the axis below its point, where the board puts it', () => {
    expect(placeLabelY(120, 'below', 10)).toBe(136);
  });

  it('drops a label under a point too close to the top to sit above it', () => {
    expect(placeLabelY(4, 'above', 10)).toBe(20);
    expect(placeLabelY(67.2, 'above', 10)).toBe(60.2);
  });
});
