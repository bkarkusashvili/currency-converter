import { RatesSnapshot } from './exchange-rate.types';

// The upstream seam. Its implementation owns the timeout, the retries and the
// circuit breaker; a caller only sees a snapshot or a rejection.
export interface RatesProvider {
  fetchRates(): Promise<RatesSnapshot>;
}

export const RATES_PROVIDER = Symbol('RATES_PROVIDER');
