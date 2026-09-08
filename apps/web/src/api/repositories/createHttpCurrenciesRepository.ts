import { request } from '../http/request';
import type { CurrenciesResponse } from '../types';
import type { CurrenciesRepository } from './CurrenciesRepository';

export function createHttpCurrenciesRepository(): CurrenciesRepository {
  return {
    list(signal?: AbortSignal): Promise<CurrenciesResponse> {
      return request<CurrenciesResponse>('/api/v1/currencies', { signal });
    },
  };
}
