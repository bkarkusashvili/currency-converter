import type { CommandOutcome } from '../http/request';
import type {
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  HealthResponse,
  HistoryResponse,
  RatesSnapshotResponse,
} from '../types';

/**
 * The seam between the app and the API: one interface per route, and the
 * aggregate the rest of the app is handed. Components and hooks depend on
 * these and never on `fetch`, which is what lets the test suite inject
 * in-memory answers through `ServicesProvider` instead of intercepting
 * the network.
 *
 * They live in one file because they change together — a route added to the
 * API is a method here, an entry in `Services`, a factory in
 * `createHttpServices` and a fake in `createFakeServices`.
 */

export interface ConversionService {
  convert(request: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse>;
}

export interface CurrenciesService {
  list(signal?: AbortSignal): Promise<CurrenciesResponse>;
}

export interface RatesService {
  getSnapshot(signal?: AbortSignal): Promise<RatesSnapshotResponse>;
  /**
   * Drops both cache keys. The key is passed in rather than read from
   * anywhere: it lives in the Operations page's React state for the length of
   * a tab and is never written down (§5.2).
   */
  clearCache(apiKey: string, signal?: AbortSignal): Promise<CommandOutcome>;
}

export interface HistoryService {
  recent(limit: number, signal?: AbortSignal): Promise<HistoryResponse>;
}

export interface HealthService {
  report(signal?: AbortSignal): Promise<HealthResponse>;
}

export interface Services {
  conversion: ConversionService;
  currencies: CurrenciesService;
  rates: RatesService;
  history: HistoryService;
  health: HealthService;
}
