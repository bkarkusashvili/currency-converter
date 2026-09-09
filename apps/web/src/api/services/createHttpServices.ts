import { request } from '../http/request';
import type {
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  ExchangeRate,
  HealthIndicator,
  HealthResponse,
  HistoryResponse,
  RatesSnapshotResponse,
} from '../types';
import type {
  ConversionService,
  CurrenciesService,
  HealthService,
  HistoryService,
  RatesService,
  Services,
} from './services';

/** The implementation the app runs with: every seam in `services.ts`, over HTTP. */
export function createHttpServices(): Services {
  return {
    conversion: createHttpConversionService(),
    currencies: createHttpCurrenciesService(),
    rates: createHttpRatesService(),
    history: createHttpHistoryService(),
    health: createHttpHealthService(),
  };
}

export function createHttpConversionService(): ConversionService {
  return {
    convert(payload: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse> {
      return request<ConvertResponse>('/api/v1/convert', { method: 'POST', body: payload, signal });
    },
  };
}

export function createHttpCurrenciesService(): CurrenciesService {
  return {
    list(signal?: AbortSignal): Promise<CurrenciesResponse> {
      return request<CurrenciesResponse>('/api/v1/currencies', { signal });
    },
  };
}

export function createHttpHistoryService(): HistoryService {
  return {
    recent(limit: number, signal?: AbortSignal): Promise<HistoryResponse> {
      return request<HistoryResponse>(`/api/v1/history?limit=${String(limit)}`, { signal });
    },
  };
}

/**
 * The snapshot is the one response this client does arithmetic with rather than
 * only render, and it is kept across reloads, so a body that is not a snapshot
 * is rejected here instead of dividing by an `undefined` in the offline
 * estimate much later.
 */
export function createHttpRatesService(): RatesService {
  return {
    getSnapshot(signal?: AbortSignal): Promise<RatesSnapshotResponse> {
      return request<RatesSnapshotResponse>('/api/v1/rates', { signal, parse: toRatesSnapshot });
    },
  };
}

const HEALTH_PATH = '/health';

/** Both statuses carry the terminus report; only the report itself says what is down. */
const REPORTED_STATUSES = [200, 503] as const;

export function createHttpHealthService(): HealthService {
  return {
    report(signal?: AbortSignal): Promise<HealthResponse> {
      return request<HealthResponse>(HEALTH_PATH, {
        signal,
        acceptStatuses: REPORTED_STATUSES,
        parse: toHealthReport,
      });
    },
  };
}

function toRatesSnapshot(body: unknown): RatesSnapshotResponse | null {
  return isRatesSnapshot(body) ? body : null;
}

function isRatesSnapshot(body: unknown): body is RatesSnapshotResponse {
  return (
    isRecord(body) &&
    typeof body.source === 'string' &&
    typeof body.fetchedAt === 'string' &&
    Array.isArray(body.rates) &&
    body.rates.every(isExchangeRate)
  );
}

function isExchangeRate(value: unknown): value is ExchangeRate {
  return (
    isRecord(value) &&
    typeof value.base === 'string' &&
    typeof value.quote === 'string' &&
    typeof value.date === 'string' &&
    isOptionalNumber(value.buy) &&
    isOptionalNumber(value.sell) &&
    isOptionalNumber(value.cross)
  );
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function toHealthReport(body: unknown): HealthResponse | null {
  return isHealthReport(body) ? body : null;
}

function isHealthReport(body: unknown): body is HealthResponse {
  return (
    isRecord(body) &&
    typeof body.status === 'string' &&
    isRecord(body.details) &&
    Object.values(body.details).every(isIndicator)
  );
}

function isIndicator(value: unknown): value is HealthIndicator {
  return isRecord(value) && typeof value.status === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
