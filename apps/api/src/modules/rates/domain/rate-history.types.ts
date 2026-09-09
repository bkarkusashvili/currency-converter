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

// One day of one pair, in the orientation the upstream publishes it: a point
// carries `buy` and `sell` when the bank quotes a spread and `cross` when it
// quotes a mid rate, exactly as the snapshot did (§5).
export interface RateHistoryPoint {
  // 'YYYY-MM-DD', UTC.
  date: string;
  buy?: number;
  sell?: number;
  cross?: number;
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
