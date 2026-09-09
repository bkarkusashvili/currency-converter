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
 *
 * **Retries.** It inherits the client's one, and that is the right number
 * rather than an oversight it has not been rescued from. The failure worth
 * asking twice about is a 503 or a connection that dropped, where a second ask
 * costs a second and often answers; the 422 that a swap of a published pair
 * produces is the archive saying "not this pair", which no number of asks
 * changes — and the panel reads it as its empty state, so it never reaches the
 * retry at all. Beyond the one, the reader has a `Try again` button, which is
 * a better third attempt than a silent one. Overriding it here would also take
 * the choice away from the test client, which turns retries off so a failing
 * case fails at once instead of after a backoff.
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
