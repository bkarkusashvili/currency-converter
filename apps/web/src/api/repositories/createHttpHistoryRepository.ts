import { request } from '../http/request';
import type { HistoryResponse } from '../types';
import type { HistoryRepository } from './HistoryRepository';

export function createHttpHistoryRepository(): HistoryRepository {
  return {
    recent(limit: number, signal?: AbortSignal): Promise<HistoryResponse> {
      return request<HistoryResponse>(`/api/v1/history?limit=${String(limit)}`, { signal });
    },
  };
}
