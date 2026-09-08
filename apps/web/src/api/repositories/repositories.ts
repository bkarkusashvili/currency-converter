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
 * in-memory answers through `RepositoriesProvider` instead of intercepting
 * the network.
 *
 * They live in one file because they change together — a route added to the
 * API is a method here, an entry in `Repositories`, a factory in
 * `createHttpRepositories` and a fake in `createFakeRepositories`.
 */

export interface ConversionRepository {
  convert(request: ConvertRequest, signal?: AbortSignal): Promise<ConvertResponse>;
}

export interface CurrenciesRepository {
  list(signal?: AbortSignal): Promise<CurrenciesResponse>;
}

export interface RatesRepository {
  getSnapshot(signal?: AbortSignal): Promise<RatesSnapshotResponse>;
}

export interface HistoryRepository {
  recent(limit: number, signal?: AbortSignal): Promise<HistoryResponse>;
}

export interface HealthRepository {
  report(signal?: AbortSignal): Promise<HealthResponse>;
}

export interface Repositories {
  conversion: ConversionRepository;
  currencies: CurrenciesRepository;
  rates: RatesRepository;
  history: HistoryRepository;
  health: HealthRepository;
}
