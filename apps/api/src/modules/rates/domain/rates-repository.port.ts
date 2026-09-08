import { CachedSnapshot, CacheWrite } from './cache-outcome';
import { RatesSnapshot } from './rates-snapshot';

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
