import type { HistoryResponse } from '../types';

export interface HistoryRepository {
  recent(limit: number, signal?: AbortSignal): Promise<HistoryResponse>;
}
