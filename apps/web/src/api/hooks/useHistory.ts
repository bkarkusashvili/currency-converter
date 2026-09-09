import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useServices } from '../services/useServices';
import type { HistoryResponse } from '../types';

export function useHistory(limit: number): UseQueryResult<HistoryResponse, ApiError> {
  const { history } = useServices();

  return useQuery<HistoryResponse, ApiError>({
    queryKey: queryKeys.history.list(limit),
    queryFn: ({ signal }) => history.recent(limit, signal),
  });
}
