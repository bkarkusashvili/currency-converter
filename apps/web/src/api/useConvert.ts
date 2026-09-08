import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { convert } from './endpoints';
import type { ApiError } from './errors';
import { queryKeys } from './queryKeys';
import type { ConvertRequest, ConvertResponse } from './types';

export function useConvert(): UseMutationResult<ConvertResponse, ApiError, ConvertRequest> {
  const queryClient = useQueryClient();

  return useMutation<ConvertResponse, ApiError, ConvertRequest>({
    mutationFn: (payload) => convert(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
    },
  });
}
