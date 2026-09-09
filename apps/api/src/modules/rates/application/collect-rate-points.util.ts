import {
  RateNotAvailableError,
  UnsupportedCurrencyError,
} from '../../../common/errors';
import { CurrencyCode } from '../../../common/currency';
import {
  ArchivedSnapshot,
  RateHistoryPoint,
} from '../domain/rate-history.types';

// One point per archived day that published the pair, oldest first — the order
// the archive already answers in, so this never sorts.
//
// The orientation is exact: `USD/UAH` is the pair Monobank publishes and
// `UAH/USD` is not, and this route reports what was published rather than what
// could be derived from it. Inverting a spread means deciding which side of it
// a reversed `buy` is, and composing a cross means pricing a pair from two
// days-old legs — both are §5's job on a live snapshot, where the client can
// see the strategy that priced them, and neither belongs in a chart of
// published quotes.
//
// The two 422s the route can answer with are decided here because they are one
// question asked of the same set of days: whether a code was quoted at all in
// the window, and then whether this pair was. Split across two passes at two
// layers they would answer from two different reads of the archive.
export function collectRatePoints(
  snapshots: ArchivedSnapshot[],
  base: CurrencyCode,
  quote: CurrencyCode,
): RateHistoryPoint[] {
  requireQuoted(snapshots, base);
  requireQuoted(snapshots, quote);

  const points = snapshots.flatMap((snapshot) => {
    const rate = snapshot.rates.find(
      (entry) => entry.base === base && entry.quote === quote,
    );

    if (rate === undefined) {
      return [];
    }

    // Spread rather than assigned undefined: a pair carries either a spread or
    // a mid rate (§5), and a `cross: undefined` on every spread point is a key
    // every client has to look past.
    return [
      {
        date: snapshot.date,
        ...(rate.buy === undefined ? {} : { buy: rate.buy }),
        ...(rate.sell === undefined ? {} : { sell: rate.sell }),
        ...(rate.cross === undefined ? {} : { cross: rate.cross }),
      },
    ];
  });

  // An empty series and a pair that was never published are the same bytes, and
  // they are not the same answer: the client asked for something the archive
  // has no record of, which is exactly what /convert answers 422 for.
  if (points.length === 0) {
    throw new RateNotAvailableError(base, quote);
  }

  return points;
}

// A code the window never mentions on either side of a pair is not a currency
// this API can chart, whether it is misspelt, delisted or simply never quoted
// by the upstream. An empty archive therefore answers this rather than an empty
// series, which is the honest reading: nothing in the window says the code
// exists.
function requireQuoted(
  snapshots: ArchivedSnapshot[],
  code: CurrencyCode,
): void {
  const quoted = snapshots.some((snapshot) =>
    snapshot.rates.some((rate) => rate.base === code || rate.quote === code),
  );

  if (!quoted) {
    throw new UnsupportedCurrencyError(code);
  }
}
