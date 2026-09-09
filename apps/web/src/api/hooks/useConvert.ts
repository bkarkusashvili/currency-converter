import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useServices } from '../services/useServices';
import type { ConvertRequest, ConvertResponse } from '../types';

export function useConvert(): UseMutationResult<ConvertResponse, ApiError, ConvertRequest> {
  const { conversion } = useServices();
  const queryClient = useQueryClient();

  return useMutation<ConvertResponse, ApiError, ConvertRequest>({
    mutationFn: (payload) => conversion.convert(payload),
    // A browser query-core believes is offline would otherwise have this
    // mutation paused rather than run: no request, no error, and a button left
    // at "Converting..." forever. The offline estimate is answered from the
    // rejection, so the request is always attempted and the transport decides.
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
    },
  });
}
