import { describe, expect, it } from 'vitest';
import type { RateHistoryPoint } from '../../../api';
import { FAKE_RESPONSES } from '../../../test/fakes/createFakeServices';
import { buildRateHistorySeries, CHART } from '../lib/rateHistorySeries';

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
    expect([series.min.absorbed, series.max.absorbed]).toEqual([false, false]);
  });

  it('lets the latest point absorb the marker when it is itself the low', () => {
    const falling = week.map((point, index) => ({ ...point, buy: 44.4 - index / 100 }));
    const series = build(falling);

    expect(series.min.index).toBe(falling.length - 1);
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
    // The one day it has is its first, its last, its low, its high and its
    // latest, and one point is drawn once — with its label under it rather
    // than hanging off an edge it is nowhere near.
    expect(series.change).toMatchObject({ direction: 'flat', first: 44.35, last: 44.35 });
    expect(series.latest.note).toBe('min');
    // Its buy is the latest point and is drawn as it; its sell is the high of
    // the other line, which still gets a circle of its own.
    expect([series.min.absorbed, series.max.absorbed]).toEqual([true, false]);
    expect(series.labels).toEqual([
      expect.objectContaining({ anchor: 'middle', x: (CHART.left + CHART.right) / 2 }),
    ]);

    // One day of a pair with no spread is one point, and one circle.
    const cross = build([{ date: '2026-09-09', cross: 0.850512 }]);
    expect([cross.min.absorbed, cross.max.absorbed]).toEqual([true, true]);
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

  it('flips the latest label to the other side of a point at the left edge', () => {
    const series = build([{ date: '2026-09-09', buy: 44.35, sell: 44.83 }]);
    const atEdge = buildRateHistorySeries([
      { date: '2026-09-08', buy: 44.35, sell: 44.83 },
      { date: '2026-09-09', buy: 44.35, sell: 44.83 },
    ]);

    expect(series.latest.anchor).toBe('end');
    expect(atEdge?.latest.anchor).toBe('end');
    expect(series.latest.labelX).toBeLessThan(series.latest.x);
  });
});
