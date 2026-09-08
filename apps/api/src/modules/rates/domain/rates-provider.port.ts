import { RatesSnapshot } from './rates-snapshot';

// The upstream seam. Its implementation owns the timeout, the retries and the
// circuit breaker; a caller only sees a snapshot or a rejection.
export interface RatesProvider {
  fetchRates(): Promise<RatesSnapshot>;
}
