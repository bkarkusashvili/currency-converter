import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getHealth } from './endpoints';
import type { ApiError } from './errors';
import { queryKeys } from './queryKeys';
import type { HealthResponse } from './types';

const REFETCH_INTERVAL_MS = 30_000;

export function useHealth(): UseQueryResult<HealthResponse, ApiError> {
  return useQuery<HealthResponse, ApiError>({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: 0,
  });
}
