import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useRepositories } from '../repositories/useRepositories';
import type { HealthResponse } from '../types';

const REFETCH_INTERVAL_MS = 30_000;

export function useHealth(): UseQueryResult<HealthResponse, ApiError> {
  const { health } = useRepositories();

  return useQuery<HealthResponse, ApiError>({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => health.report(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: 0,
    // A degraded API answers 503 with the report; a failure here means the endpoint is unreachable.
    retry: false,
  });
}
