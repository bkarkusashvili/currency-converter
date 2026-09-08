export type ConversionStrategy = 'identity' | 'direct' | 'cross';

export type RateSource = 'cache' | 'provider' | 'stale-cache';

export interface ConvertRequest {
  from: string;
  to: string;
  amount: number;
}

export interface ConvertResponse {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategy;
  source: RateSource;
  ratesTimestamp: string;
}

export interface Currency {
  code: string;
  numericCode: number;
  name: string;
}

export interface CurrenciesResponse {
  currencies: Currency[];
}

export interface HistoryItem {
  id: string;
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategy;
  createdAt: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

export type HealthStatus = 'ok' | 'error' | 'shutting_down';

export interface HealthIndicator {
  status: 'up' | 'down';
  [key: string]: unknown;
}

export interface HealthResponse {
  status: HealthStatus;
  info?: Record<string, HealthIndicator>;
  error?: Record<string, HealthIndicator>;
  details: Record<string, HealthIndicator>;
}
