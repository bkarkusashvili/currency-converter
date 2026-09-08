import { request } from '../http/request';
import type { ConvertRequest, ConvertResponse } from '../types';
import type { ConversionRepository } from './ConversionRepository';

export function createHttpConversionRepository(): ConversionRepository {
  return {
    convert(payload: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse> {
      return request<ConvertResponse>('/api/v1/convert', { method: 'POST', body: payload, signal });
    },
  };
}
