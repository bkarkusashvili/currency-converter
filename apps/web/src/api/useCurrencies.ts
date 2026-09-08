import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCurrencies } from './endpoints';
import type { ApiError } from './errors';
import { queryKeys } from './queryKeys';
import type { CurrenciesResponse } from './types';

export function useCurrencies(): UseQueryResult<CurrenciesResponse, ApiError> {
  return useQuery<CurrenciesResponse, ApiError>({
    queryKey: queryKeys.currencies,
    queryFn: ({ signal }) => getCurrencies(signal),
    staleTime: 5 * 60 * 1000,
  });
}
