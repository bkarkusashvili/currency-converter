import { CurrencyCode } from '../../../common/currency';
import { ExchangeRate } from './exchange-rate.types';

// One archived day. The key is the UTC day the snapshot was fetched on, which
// is what makes the collection hold at most one document per day; `fetchedAt`
// is the fetch that produced the rates it holds, and it is the timestamp a
// response served from the archive publishes.
export interface ArchivedSnapshot {
  // 'YYYY-MM-DD', UTC.
  date: string;
  // ISO timestamp of the upstream fetch, as RatesSnapshot publishes it.
  fetchedAt: string;
  rates: ExchangeRate[];
}

// What the upstream published for one pair on one day: a spread, or a mid
// rate, never both (§5).
export interface PublishedRate {
  buy?: number;
  sell?: number;
  cross?: number;
}

// One archived day as /rates/history reads it — the pair projected out of the
// day rather than the day itself. A day document is the whole published board,
// several kilobytes of it, and this route answers three numbers per day from
// it: the store filters `rates` down to the one pair asked for and answers two
// flags for the codes, so the bytes that cross the wire are the ones the answer
// is made of.
//
// The flags are what keep §3's three outcomes decidable from a single read:
// whether each code was quoted at all in the window (`UNSUPPORTED_CURRENCY`),
// and then whether this pair was (`RATE_NOT_AVAILABLE`). Projecting the pair
// alone would make an unquoted code and an unpublished pair the same empty
// answer.
export interface ArchivedPairDay {
  // 'YYYY-MM-DD', UTC.
  date: string;
  // Absent on a day that archived rates but not this pair.
  rate?: PublishedRate;
  // Whether the day quoted the code on either side of any pair it published.
  quotesBase: boolean;
  quotesQuote: boolean;
}

// One day of one pair, in the orientation the upstream publishes it: a point
// carries `buy` and `sell` when the bank quotes a spread and `cross` when it
// quotes a mid rate, exactly as the snapshot did (§5).
export interface RateHistoryPoint extends PublishedRate {
  // 'YYYY-MM-DD', UTC.
  date: string;
}

// What /rates/history is asked for, after validation: the codes upper-cased and
// the window resolved to its default. The DTO implements it, so the service
// takes the domain shape rather than a class carrying HTTP decorators.
export interface RateHistoryQuery {
  base: CurrencyCode;
  quote: CurrencyCode;
  days: number;
}

// What /rates/history answers with: the pair as it was asked for, the window it
// was asked over, and one point per archived day inside it that published the
// pair — oldest first, and shorter than `days` whenever the archive has gaps.
export interface RateHistory {
  base: CurrencyCode;
  quote: CurrencyCode;
  days: number;
  points: RateHistoryPoint[];
}
