import { ApiError } from '../../api';
import type {
  CommandOutcome,
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  HealthResponse,
  HistoryResponse,
  RateHistoryQuery,
  RateHistoryResponse,
  RatesSnapshotResponse,
  Services,
} from '../../api';

/** Either the value the service answers with, or the error it rejects with. */
export type Answer<T> = T | ApiError;

export interface FakeServicesOptions {
  convert?: Answer<ConvertResponse>;
  currencies?: Answer<CurrenciesResponse>;
  rates?: Answer<RatesSnapshotResponse>;
  rateHistory?: Answer<RateHistoryResponse>;
  history?: Answer<HistoryResponse>;
  health?: Answer<HealthResponse>;
  clearCache?: Answer<CommandOutcome>;
}

export interface FakeServices {
  services: Services;
  convertCalls: ConvertRequest[];
  historyLimits: number[];
  /** Every window the rate-history panel asked for, in order, so a suite can check the range it sent. */
  rateHistoryQueries: RateHistoryQuery[];
  /** The keys `clearCache` was called with, so a suite can prove what was sent. */
  clearCacheKeys: string[];
}

/**
 * One representative of every response this client knows how to receive, and
 * the one table the component suites build their fixtures from:
 * `ConverterPage.test.tsx`, `offlineFallback.test.tsx` and
 * `AboutPage.test.tsx` spread these and override the fields their case is
 * about, so the bodies validated below are the bodies the pages render.
 *
 * `openapiContract.test.ts` validates each of them against the schema
 * `docs/openapi.json` publishes for its route, which is what keeps
 * `api/types.ts` — a hand-written mirror of the API's DTOs — honest. What that
 * catches is a required field gone missing, a value outside an enum and a
 * wrong type: it fails here rather than in a browser. What it cannot catch is
 * a field this client invented, because the published schemas do not set
 * `additionalProperties: false`.
 */
export const FAKE_RESPONSES = {
  convert: {
    from: 'EUR',
    to: 'PLN',
    amount: 100,
    result: 425.71,
    rate: 4.257112,
    strategy: 'cross',
    source: 'stale-cache',
    ratesTimestamp: '2024-03-05T12:00:00.000Z',
    warnings: [{ code: 'CACHE_UNAVAILABLE', message: 'The rates cache could not be reached.' }],
  } satisfies ConvertResponse,
  currencies: {
    currencies: [
      { code: 'EUR', numericCode: 978, name: 'Euro' },
      { code: 'PLN', numericCode: 985, name: 'Zloty' },
      { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
      { code: 'USD', numericCode: 840, name: 'US Dollar' },
    ],
  } satisfies CurrenciesResponse,
  rates: {
    source: 'cache',
    fetchedAt: '2026-09-08T12:00:00.000Z',
    rates: [
      { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: '2026-09-08T11:00:00.000Z' },
      { base: 'GBP', quote: 'UAH', cross: 60.7562, date: '2026-09-08T11:00:00.000Z' },
    ],
  } satisfies RatesSnapshotResponse,
  rateHistory: {
    base: 'USD',
    quote: 'UAH',
    days: 7,
    points: [
      { date: '2026-09-03', buy: 44.21, sell: 44.7 },
      { date: '2026-09-04', buy: 44.28, sell: 44.76 },
      { date: '2026-09-05', buy: 44.19, sell: 44.68 },
      { date: '2026-09-06', buy: 44.25, sell: 44.74 },
      { date: '2026-09-07', buy: 44.33, sell: 44.81 },
      { date: '2026-09-08', buy: 44.3, sell: 44.79 },
      { date: '2026-09-09', buy: 44.35, sell: 44.83 },
    ],
  } satisfies RateHistoryResponse,
  history: {
    items: [
      {
        id: '6f0000000000000000000001',
        from: 'EUR',
        to: 'PLN',
        amount: 100,
        result: 425.71,
        rate: 4.257112,
        strategy: 'cross',
        source: 'cache',
        ratesTimestamp: '2026-09-08T12:00:00.000Z',
        createdAt: '2026-09-08T12:00:05.000Z',
      },
    ],
  } satisfies HistoryResponse,
  health: {
    status: 'ok',
    info: { redis: { status: 'up' } },
    error: {},
    details: { redis: { status: 'up' }, mongodb: { status: 'up' } },
  } satisfies HealthResponse,
};

const EMPTY_CURRENCIES: CurrenciesResponse = { currencies: [] };
const EMPTY_HISTORY: HistoryResponse = { items: [] };
const HEALTHY: HealthResponse = { status: 'ok', details: {} };
const CLEARED: CommandOutcome = { status: 204, requestId: 'req-42' };
const EMPTY_SNAPSHOT: RatesSnapshotResponse = {
  source: 'cache',
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [],
};
/** No day recorded for the pair, which is the panel's empty state. */
const EMPTY_RATE_HISTORY: RateHistoryResponse = {
  base: 'USD',
  quote: 'UAH',
  days: 7,
  points: [],
};

/**
 * In-memory stand-in for the service layer. Tests inject it through
 * ServicesProvider instead of mocking the HTTP modules.
 */
export function createFakeServices(options: FakeServicesOptions = {}): FakeServices {
  const convertCalls: ConvertRequest[] = [];
  const historyLimits: number[] = [];
  const rateHistoryQueries: RateHistoryQuery[] = [];
  const clearCacheKeys: string[] = [];

  const services: Services = {
    conversion: {
      convert(request) {
        convertCalls.push(request);
        return answer(options.convert ?? neverConverted());
      },
    },
    currencies: {
      list: () => answer(options.currencies ?? EMPTY_CURRENCIES),
    },
    rates: {
      getSnapshot: () => answer(options.rates ?? EMPTY_SNAPSHOT),
      getHistory(query) {
        rateHistoryQueries.push(query);
        return answer(options.rateHistory ?? EMPTY_RATE_HISTORY);
      },
      clearCache(apiKey) {
        clearCacheKeys.push(apiKey);
        return answer(options.clearCache ?? CLEARED);
      },
    },
    history: {
      recent(limit) {
        historyLimits.push(limit);
        return answer(options.history ?? EMPTY_HISTORY);
      },
    },
    health: {
      report: () => answer(options.health ?? HEALTHY),
    },
  };

  return { services, convertCalls, historyLimits, rateHistoryQueries, clearCacheKeys };
}

function answer<T>(value: Answer<T>): Promise<T> {
  return value instanceof ApiError ? Promise.reject(value) : Promise.resolve(value);
}

function neverConverted(): ApiError {
  return new ApiError({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'The test did not configure a conversion result.',
  });
}
