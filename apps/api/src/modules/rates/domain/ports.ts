import { RatesSnapshot } from './exchange-rate';

// The upstream seam. Its implementation owns the timeout, the retries and the
// circuit breaker; a caller only sees a snapshot or a rejection.
export interface RatesProvider {
  fetchRates(): Promise<RatesSnapshot>;
}

export const RATES_PROVIDER = Symbol('RATES_PROVIDER');

// What a cache operation did, and whether the cache was there to do it.
//
// A read that answers `null` alone cannot tell a miss from an outage, and §3
// gives the two different answers: a miss is priced from the upstream and
// nobody needs to hear about it, while a cache that could not be reached is a
// `CACHE_UNAVAILABLE` warning on the response — the request is slower, the
// answer was not cached for the next one, and until now the only place that
// was said was the log.
export interface CachedSnapshot {
  snapshot: RatesSnapshot | null;
  degraded: boolean;
}

export interface CacheWrite {
  degraded: boolean;
}

// The cache seam. The two request-path methods degrade rather than throwing —
// the cache being down slows a request, it does not fail one — but they report
// that they did, so the answer can say so too.
//
// `clear` is the exception, and deliberately: it is not a read on the way to an
// answer but a state change the caller asked for, and reporting success for a
// key that is still there tells an operator the cache is empty when it is not.
export interface RatesRepository {
  getFresh(): Promise<CachedSnapshot>;
  getStale(): Promise<CachedSnapshot>;
  save(snapshot: RatesSnapshot): Promise<CacheWrite>;
  // Resolves when both keys are gone, including when they were already absent:
  // the caller stated a wanted end state. Rejects with `CacheUnavailableError`
  // when the cache could not be reached or refused the command, because the
  // keys are then still there — which is what /rates/cache answers 503 for
  // (§3), rather than the 204 a degraded no-op would have produced.
  clear(): Promise<void>;
}

export const RATES_REPOSITORY = Symbol('RATES_REPOSITORY');
