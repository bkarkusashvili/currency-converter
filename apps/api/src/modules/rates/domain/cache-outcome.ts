import { RatesSnapshot } from './rates-snapshot';

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
