import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useServices } from '../services/useServices';
import type { CurrenciesResponse } from '../types';

const STALE_TIME_MS = 5 * 60 * 1000;

export function useCurrencies(): UseQueryResult<CurrenciesResponse, ApiError> {
  const { currencies } = useServices();

  return useQuery<CurrenciesResponse, ApiError>({
    queryKey: queryKeys.currencies,
    queryFn: ({ signal }) => currencies.list(signal),
    staleTime: STALE_TIME_MS,
    // As with the snapshot: attempt the request rather than park it, so the
    // form falls back to the persisted list instead of waiting on a query that
    // never ran.
    networkMode: 'always',
    // As with the snapshot: one attempt, reported, rather than a retry parked
    // behind the tab being focused.
    retry: 0,
  });
}
