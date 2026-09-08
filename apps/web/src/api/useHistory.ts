import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getHistory } from './endpoints';
import type { ApiError } from './errors';
import { queryKeys } from './queryKeys';
import type { HistoryResponse } from './types';

export function useHistory(limit: number): UseQueryResult<HistoryResponse, ApiError> {
  return useQuery<HistoryResponse, ApiError>({
    queryKey: queryKeys.history.list(limit),
    queryFn: ({ signal }) => getHistory(limit, signal),
  });
}
