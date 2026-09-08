import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useRepositories } from '../repositories/useRepositories';
import type { RatesSnapshotResponse } from '../types';

/**
 * The API caches a snapshot for RATES_CACHE_TTL_SECONDS (300 by default), so
 * refetching faster than that only re-reads the same Redis key.
 */
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The rates the API would convert with. It is fetched for its own sake rather
 * than to be rendered: persisted, it is what the offline estimate prices a
 * conversion from when the API cannot be reached.
 */
export function useRatesSnapshot(): UseQueryResult<RatesSnapshotResponse, ApiError> {
  const { rates } = useRepositories();

  return useQuery<RatesSnapshotResponse, ApiError>({
    queryKey: queryKeys.rates,
    queryFn: ({ signal }) => rates.getSnapshot(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
  });
}
