import { RatesSnapshot } from './rates-snapshot';

// The cache seam. Every method degrades rather than throwing: the cache being
// down slows a request, it does not fail one.
export interface RatesRepository {
  getFresh(): Promise<RatesSnapshot | null>;
  getStale(): Promise<RatesSnapshot | null>;
  save(snapshot: RatesSnapshot): Promise<void>;
  clear(): Promise<void>;
}
