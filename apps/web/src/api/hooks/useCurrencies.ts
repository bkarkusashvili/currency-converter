import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useRepositories } from '../repositories/useRepositories';
import type { CurrenciesResponse } from '../types';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useCurrencies(): UseQueryResult<CurrenciesResponse, ApiError> {
  const { currencies } = useRepositories();

  return useQuery<CurrenciesResponse, ApiError>({
    queryKey: queryKeys.currencies,
    queryFn: ({ signal }) => currencies.list(signal),
    staleTime: STALE_TIME_MS,
  });
}
