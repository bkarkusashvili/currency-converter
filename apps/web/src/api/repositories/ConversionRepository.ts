import type { ConvertRequest, ConvertResponse } from '../types';

export interface ConversionRepository {
  convert(request: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse>;
}
