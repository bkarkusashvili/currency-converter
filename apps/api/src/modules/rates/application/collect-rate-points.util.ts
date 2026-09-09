import {
  RateNotAvailableError,
  UnsupportedCurrencyError,
} from '../../../common/errors';
import { CurrencyCode } from '../../../common/currency';
import {
  ArchivedPairDay,
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
// published quotes. The store applies that orientation in the `$filter` it
// projects each day with; what arrives here is either the pair or nothing.
//
// The two 422s the route can answer with are decided here because they are one
// question asked of the same set of days: whether a code was quoted at all in
// the window, and then whether this pair was. Split across two passes at two
// layers they would answer from two different reads of the archive. This stays
// the pure decision over the projected shape — three fields per day, no
// document — so what the store hands over can shrink without the rule moving.
export function collectRatePoints(
  days: ArchivedPairDay[],
  base: CurrencyCode,
  quote: CurrencyCode,
): RateHistoryPoint[] {
  // A code the window never mentions on either side of a pair is not a currency
  // this API can chart, whether it is misspelt, delisted or simply never quoted
  // by the upstream. An empty archive therefore answers this rather than an
  // empty series, which is the honest reading: nothing in the window says the
  // code exists.
  if (!days.some((day) => day.quotesBase)) {
    throw new UnsupportedCurrencyError(base);
  }

  if (!days.some((day) => day.quotesQuote)) {
    throw new UnsupportedCurrencyError(quote);
  }

  const points = days.flatMap(({ date, rate }) => {
    if (rate === undefined) {
      return [];
    }

    // Spread rather than assigned undefined: a pair carries either a spread or
    // a mid rate (§5), and a `cross: undefined` on every spread point is a key
    // every client has to look past.
    return [
      {
        date,
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
