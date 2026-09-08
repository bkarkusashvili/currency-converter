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

/**
 * Terminus answers `up` or `down` today. The field stays `string` because the
 * report is a runtime document, not a compiled contract: a value this client has
 * not seen has to render as it arrived rather than be typed out of existence,
 * and the guard that produces this type can only check what it can check.
 */
export interface HealthIndicator {
  status: string;
  [key: string]: unknown;
}

/** `status` is `ok`, `error` or `shutting_down` today; see HealthIndicator for why it is not a union. */
export interface HealthResponse {
  status: string;
  info?: Record<string, HealthIndicator>;
  error?: Record<string, HealthIndicator>;
  details: Record<string, HealthIndicator>;
}
