import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '../http/ApiError';
import { queryKeys } from '../queryKeys';
import { useRepositories } from '../repositories/useRepositories';
import type { ConvertRequest, ConvertResponse } from '../types';

export function useConvert(): UseMutationResult<ConvertResponse, ApiError, ConvertRequest> {
  const { conversion } = useRepositories();
  const queryClient = useQueryClient();

  return useMutation<ConvertResponse, ApiError, ConvertRequest>({
    mutationFn: (payload) => conversion.convert(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
    },
  });
}
