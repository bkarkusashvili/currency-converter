import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import type { RateHistoryQuery } from '../services/services';
import { useServices } from '../services/useServices';
import type { RateHistoryResponse } from '../types';

/**
 * The archived series for one pair and one window. Its key carries all three
 * parameters, so switching the range or the pair is a different query rather
 * than a refetch of the same one — the previous answer stays in the cache and
 * comes back instantly when the range is switched back.
 *
 * Deliberately outside the persistence allow-list (`shouldPersistQuery`): a
 * stored series would be restored a day stale and the panel it feeds is not
 * what an offline browser needs, unlike the snapshot the estimate is priced
 * from.
 */
export function useRateHistory(
  query: RateHistoryQuery,
): UseQueryResult<RateHistoryResponse, ApiError> {
  const { rates } = useServices();

  return useQuery<RateHistoryResponse, ApiError>({
    queryKey: queryKeys.rateHistory.pair(query.base, query.quote, query.days),
    queryFn: ({ signal }) => rates.getHistory(query, signal),
  });
}
