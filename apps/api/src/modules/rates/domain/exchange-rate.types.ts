import { CurrencyCode } from '../../../common/currency/currency-code.types';

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

// Where the snapshot a response was built from came from. Reported to the
// client so a stale answer is visibly stale rather than silently old.
//
// The list is the value, and the type is read off it: the response DTO has to
// enumerate the sources for OpenAPI, and a second copy of the literals is one
// that can disagree with this one.
export const RATES_SOURCES = ['cache', 'provider', 'stale-cache'] as const;

export type RatesSource = (typeof RATES_SOURCES)[number];

export interface RatesLookup {
  snapshot: RatesSnapshot;
  source: RatesSource;
  // Whether the cache failed to answer or to take a write while this lookup
  // ran. `source` says where the rates came from; this says what it cost —
  // together they are the `CACHE_UNAVAILABLE` warning §3 publishes.
  cacheDegraded: boolean;
}
