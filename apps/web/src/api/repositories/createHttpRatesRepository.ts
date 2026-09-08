import { request } from '../http/request';
import type { ExchangeRate, RatesSnapshotResponse } from '../types';
import type { RatesRepository } from './RatesRepository';

/**
 * The snapshot is the one response this client does arithmetic with rather than
 * only render, and it is kept across reloads, so a body that is not a snapshot
 * is rejected here instead of dividing by an `undefined` in the offline
 * estimate much later.
 */
export function createHttpRatesRepository(): RatesRepository {
  return {
    getSnapshot(signal?: AbortSignal): Promise<RatesSnapshotResponse> {
      return request<RatesSnapshotResponse>('/api/v1/rates', { signal, parse: toRatesSnapshot });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
