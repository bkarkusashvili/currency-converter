import type { CurrenciesResponse } from '../types';

export interface CurrenciesRepository {
  list(signal?: AbortSignal): Promise<CurrenciesResponse>;
}
