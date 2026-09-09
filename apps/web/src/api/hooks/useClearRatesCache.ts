import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import type { CommandOutcome } from '../http/request';
import { queryKeys } from '../queryKeys';
import { useServices } from '../services/useServices';

/**
 * `DELETE /api/v1/rates/cache`, with the admin key the caller is holding.
 *
 * A success invalidates the snapshot query rather than editing it: the point
 * of clearing the cache is that the next read goes to Monobank, and the card
 * that reports the snapshot should show what actually came back.
 *
 * The key is a mutation argument and never a query key, so it cannot reach the
 * persisted cache by the back door.
 */
export function useClearRatesCache(): UseMutationResult<CommandOutcome, ApiError, string> {
  const { rates } = useServices();
  const queryClient = useQueryClient();

  return useMutation<CommandOutcome, ApiError, string>({
    mutationFn: (apiKey: string) => rates.clearCache(apiKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rates }),
  });
}
