import { request } from './http';
import type {
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  HealthResponse,
  HistoryResponse,
} from './types';

export function convert(payload: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse> {
  return request<ConvertResponse>('/api/v1/convert', { method: 'POST', body: payload, signal });
}

export function getCurrencies(signal?: AbortSignal): Promise<CurrenciesResponse> {
  return request<CurrenciesResponse>('/api/v1/currencies', { signal });
}

export function getHistory(limit: number, signal?: AbortSignal): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/api/v1/history?limit=${String(limit)}`, { signal });
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { signal });
}
