import { RateNotAvailableError } from '../../../../common/errors/rate-not-available.error';
import { UnsupportedCurrencyError } from '../../../../common/errors/unsupported-currency.error';
import { ArchivedSnapshot } from '../../domain/rate-history.types';
import { collectRatePoints } from '../collect-rate-points.util';

function day(date: string, buy: number): ArchivedSnapshot {
  return {
    date,
    fetchedAt: `${date}T23:00:00.000Z`,
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy,
        sell: buy + 0.5,
        date: `${date}T22:00:00.000Z`,
      },
      {
        base: 'BTC',
        quote: 'USD',
        cross: 60756.2,
        date: `${date}T22:00:00.000Z`,
      },
    ],
  };
}

const WINDOW = [day('2026-09-06', 44.1), day('2026-09-07', 44.2)];

describe('collectRatePoints', () => {
  it('answers one point per archived day, in the order it was given', () => {
    expect(collectRatePoints(WINDOW, 'USD', 'UAH')).toStrictEqual([
      { date: '2026-09-06', buy: 44.1, sell: 44.6 },
      { date: '2026-09-07', buy: 44.2, sell: 44.7 },
    ]);
  });

  // A pair carries either a spread or a mid rate (§5), and a key set to
  // undefined is one every client has to look past.
  it('publishes a mid rate without the spread keys', () => {
    expect(collectRatePoints(WINDOW, 'BTC', 'USD')[0]).toStrictEqual({
      date: '2026-09-06',
      cross: 60756.2,
    });
  });

  // A day the archive has no snapshot for is absent rather than null, so a gap
  // is visible as a gap and the series is shorter than the window.
  it('skips a day that did not publish the pair', () => {
    const gap: ArchivedSnapshot = {
      date: '2026-09-05',
      fetchedAt: '2026-09-05T23:00:00.000Z',
      rates: [
        {
          base: 'BTC',
          quote: 'USD',
          cross: 59000,
          date: '2026-09-05T22:00:00.000Z',
        },
      ],
    };

    expect(
      collectRatePoints([gap, ...WINDOW], 'USD', 'UAH').map(
        (point) => point.date,
      ),
    ).toStrictEqual(['2026-09-06', '2026-09-07']);
  });

  it('rejects a code the window never quoted', () => {
    expect(() => collectRatePoints(WINDOW, 'XYZ', 'UAH')).toThrow(
      UnsupportedCurrencyError,
    );
    expect(() => collectRatePoints(WINDOW, 'USD', 'XYZ')).toThrow(
      UnsupportedCurrencyError,
    );
  });

  // Nothing in an empty window says the code exists, which is the honest
  // reading — and it is a different answer from "the pair was never published".
  it('rejects any code against an empty window', () => {
    expect(() => collectRatePoints([], 'USD', 'UAH')).toThrow(
      UnsupportedCurrencyError,
    );
  });

  // Both codes are quoted and there is still no series: this is the same
  // distinction §3 draws between the two 422s on /convert.
  it('rejects a pair neither day published', () => {
    expect(() => collectRatePoints(WINDOW, 'BTC', 'UAH')).toThrow(
      RateNotAvailableError,
    );
  });

  // The route reports what the upstream published rather than what could be
  // derived from it: inverting a spread means choosing which side a reversed
  // buy is, which is a pricing decision and belongs on a live snapshot (§5).
  it('rejects the reversed orientation of a pair it can serve', () => {
    expect(() => collectRatePoints(WINDOW, 'UAH', 'USD')).toThrow(
      RateNotAvailableError,
    );
  });

  it('rejects a currency against itself, which nothing publishes', () => {
    expect(() => collectRatePoints(WINDOW, 'USD', 'USD')).toThrow(
      RateNotAvailableError,
    );
  });
});
