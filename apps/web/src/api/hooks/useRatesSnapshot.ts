import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useServices } from '../services/useServices';
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
  const { rates } = useServices();

  return useQuery<RatesSnapshotResponse, ApiError>({
    queryKey: queryKeys.rates,
    queryFn: ({ signal }) => rates.getSnapshot(signal),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
    // Paused is the one state the fallback cannot use: it is neither a
    // snapshot nor a failure. The fetch is attempted whatever the browser
    // believes about the network, and a failure leaves the persisted copy in
    // place for the estimate to be priced from.
    networkMode: 'always',
    // The other half of not parking: a retry waits for the tab to be focused
    // again, so a failure in a background tab would sit unreported until
    // someone looked at it. The next interval is the retry.
    retry: 0,
  });
}
