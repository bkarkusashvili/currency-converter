import { RatesSnapshot } from './rates-snapshot';
import { RatesSource } from './rates-source';

export interface RatesLookup {
  snapshot: RatesSnapshot;
  source: RatesSource;
  // Whether the cache failed to answer or to take a write while this lookup
  // ran. `source` says where the rates came from; this says what it cost —
  // together they are the `CACHE_UNAVAILABLE` warning §3 publishes.
  cacheDegraded: boolean;
}
