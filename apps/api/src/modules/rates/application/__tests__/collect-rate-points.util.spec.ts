import { RateNotAvailableError } from '../../../../common/errors/rate-not-available.error';
import { UnsupportedCurrencyError } from '../../../../common/errors/unsupported-currency.error';
import {
  ArchivedPairDay,
  PublishedRate,
} from '../../domain/rate-history.types';
import { collectRatePoints } from '../collect-rate-points.util';

interface ProjectedDay {
  // Absent on a day that archived rates but did not publish this pair, which
  // is what the store's `$filter` answers for a gap, for the reversed
  // orientation and for a currency against itself alike.
  rate?: PublishedRate;
  quotesBase?: boolean;
  quotesQuote?: boolean;
}

// One day in the shape the archive projects it: the pair's own numbers, and one
// flag per code saying whether the day quoted it anywhere. Both flags default
// to true, so a case only states the field it is about.
function day(
  date: string,
  { rate, quotesBase = true, quotesQuote = true }: ProjectedDay = {},
): ArchivedPairDay {
  return {
    date,
    ...(rate === undefined ? {} : { rate }),
    quotesBase,
    quotesQuote,
  };
}

const WINDOW = [
  day('2026-09-06', { rate: { buy: 44.1, sell: 44.6 } }),
  day('2026-09-07', { rate: { buy: 44.2, sell: 44.7 } }),
];

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
    const mid = [day('2026-09-06', { rate: { cross: 60756.2 } })];

    expect(collectRatePoints(mid, 'BTC', 'USD')).toStrictEqual([
      { date: '2026-09-06', cross: 60756.2 },
    ]);
  });

  // A day the archive has no snapshot of the pair for is absent rather than
  // null, so a gap is visible as a gap and the series is shorter than the
  // window.
  it('skips a day that did not publish the pair', () => {
    const gap = day('2026-09-05');

    expect(
      collectRatePoints([gap, ...WINDOW], 'USD', 'UAH').map(
        (point) => point.date,
      ),
    ).toStrictEqual(['2026-09-06', '2026-09-07']);
  });

  it('rejects a code no day in the window quoted', () => {
    const unquotedBase = WINDOW.map((archived) => ({
      ...archived,
      quotesBase: false,
    }));

    expect(() => collectRatePoints(unquotedBase, 'XYZ', 'UAH')).toThrow(
      UnsupportedCurrencyError,
    );
  });

  // Which of the two codes was never quoted is what the client is told, so the
  // flags are read one at a time rather than as one "either is missing".
  it('names the unquoted code rather than the pair', () => {
    const unquotedQuote = WINDOW.map((archived) => ({
      ...archived,
      quotesQuote: false,
    }));

    expect(() => collectRatePoints(unquotedQuote, 'USD', 'XYZ')).toThrow(
      expect.objectContaining({
        details: { currency: 'XYZ' },
      }) as Error,
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
  // distinction §3 draws between the two 422s on /convert. The reversed
  // orientation of a pair the archive can serve, and a currency against itself,
  // both arrive here as exactly this — the store filters on the orientation, so
  // what is left is a window of days with no rate in them.
  it('rejects a pair no day published, both codes being quoted', () => {
    const quotedButUnpaired = [day('2026-09-06'), day('2026-09-07')];

    expect(() => collectRatePoints(quotedButUnpaired, 'BTC', 'UAH')).toThrow(
      RateNotAvailableError,
    );
  });
});
