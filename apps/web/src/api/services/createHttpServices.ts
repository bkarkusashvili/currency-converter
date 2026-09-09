import { request, requestCommand } from '../http/request';
import type {
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  ExchangeRate,
  HealthIndicator,
  HealthResponse,
  HistoryResponse,
  RateHistoryPoint,
  RateHistoryResponse,
  RatesSnapshotResponse,
} from '../types';
import type {
  ConversionService,
  CurrenciesService,
  HealthService,
  HistoryService,
  RateHistoryQuery,
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
      return request<RatesSnapshotResponse>(RATES_PATH, { signal, parse: toRatesSnapshot });
    },

    clearCache(apiKey: string, signal?: AbortSignal) {
      return requestCommand(`${RATES_PATH}/cache`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
        signal,
      });
    },

    /**
     * The series is the other response this client computes with rather than
     * only renders — the chart scales it, and a `points` that is not an array
     * of numbers divides by an `undefined` somewhere inside an SVG path — so
     * it is checked here, where the failure can still be reported as one.
     */
    getHistory(query: RateHistoryQuery, signal?: AbortSignal): Promise<RateHistoryResponse> {
      const search = new URLSearchParams({
        base: query.base,
        quote: query.quote,
        days: String(query.days),
      });

      return request<RateHistoryResponse>(`/api/v1/rates/history?${search.toString()}`, {
        signal,
        parse: toRateHistory,
      });
    },
  };
}

const RATES_PATH = '/api/v1/rates';

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

function toRateHistory(body: unknown): RateHistoryResponse | null {
  return isRateHistory(body) ? body : null;
}

function isRateHistory(body: unknown): body is RateHistoryResponse {
  return (
    isRecord(body) &&
    typeof body.base === 'string' &&
    typeof body.quote === 'string' &&
    typeof body.days === 'number' &&
    Array.isArray(body.points) &&
    body.points.every(isRateHistoryPoint)
  );
}

function isRateHistoryPoint(value: unknown): value is RateHistoryPoint {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    isOptionalNumber(value.buy) &&
    isOptionalNumber(value.sell) &&
    isOptionalNumber(value.cross)
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
