import { CurrencyCode } from '../../../common/currency';
import { RatesSource } from './rates-source.enum';

// Monobank is a Ukrainian bank: every pair it publishes is either against the
// hryvnia or between two foreign currencies, and UAH is what a cross rate
// routes through. It is a property of the rate source, not of a conversion.
export const BASE_CURRENCY: CurrencyCode = 'UAH';

export interface ExchangeRate {
  // Monobank's currencyCodeA: one unit of it costs the quoted amount of quote.
  base: CurrencyCode;
  // Monobank's currencyCodeB.
  quote: CurrencyCode;
  // The bank buys base and pays quote.
  buy?: number;
  // The bank sells base and receives quote.
  sell?: number;
  // Mid rate, published for the pairs that have no spread.
  cross?: number;
  // ISO timestamp of the upstream quote, not of the fetch.
  date: string;
}

export interface RatesSnapshot {
  // ISO timestamp of the upstream fetch that produced these rates.
  fetchedAt: string;
  rates: ExchangeRate[];
}

export interface RatesLookup {
  snapshot: RatesSnapshot;
  source: RatesSource;
  // Whether the cache failed to answer or to take a write while this lookup
  // ran. `source` says where the rates came from; this says what it cost —
  // together they are the `CACHE_UNAVAILABLE` warning §3 publishes.
  cacheDegraded: boolean;
  // Whether a snapshot this lookup fetched could not be archived. Only a
  // lookup that reached the upstream has anything to archive, so this is
  // `false` on every other branch — and it is the `ARCHIVE_NOT_RECORDED`
  // warning §3 publishes, which says the day is missing from /rates/history
  // rather than anything about the answer being held.
  archiveDegraded: boolean;
}
