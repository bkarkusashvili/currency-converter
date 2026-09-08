import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useRepositories } from '../repositories/useRepositories';
import type { HistoryResponse } from '../types';

export function useHistory(limit: number): UseQueryResult<HistoryResponse, ApiError> {
  const { history } = useRepositories();

  return useQuery<HistoryResponse, ApiError>({
    queryKey: queryKeys.history.list(limit),
    queryFn: ({ signal }) => history.recent(limit, signal),
  });
}
