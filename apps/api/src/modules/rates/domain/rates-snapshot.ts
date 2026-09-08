import { ExchangeRate } from './exchange-rate';

export interface RatesSnapshot {
  // ISO timestamp of the upstream fetch that produced these rates.
  fetchedAt: string;
  rates: ExchangeRate[];
}
