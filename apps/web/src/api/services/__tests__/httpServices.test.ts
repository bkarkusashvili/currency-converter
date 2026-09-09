import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../http/ApiError';
import type {
  ConvertResponse,
  HealthResponse,
  RateHistoryResponse,
  RatesSnapshotResponse,
} from '../../types';
import {
  createHttpConversionService,
  createHttpCurrenciesService,
  createHttpHealthService,
  createHttpHistoryService,
  createHttpRatesService,
  createHttpServices,
} from '../createHttpServices';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const conversion: ConvertResponse = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 84.73,
  rate: 0.847312,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

const snapshot: RatesSnapshotResponse = {
  source: 'cache',
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: '2026-09-08T11:00:00.000Z' },
    { base: 'GBP', quote: 'UAH', cross: 60.7562, date: '2026-09-08T11:00:00.000Z' },
  ],
};

const series: RateHistoryResponse = {
  base: 'USD',
  quote: 'UAH',
  days: 30,
  points: [
    { date: '2026-09-08', buy: 44.3, sell: 44.79 },
    { date: '2026-09-09', buy: 44.35, sell: 44.83 },
  ],
};

const degradedReport: HealthResponse = {
  status: 'error',
  info: { mongodb: { status: 'up' } },
  error: { redis: { status: 'down' } },
  details: { redis: { status: 'down' }, mongodb: { status: 'up' } },
};

beforeEach(() => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('createHttpConversionService', () => {
  it('posts the payload to /api/v1/convert', async () => {
    fetchMock.mockResolvedValue(jsonResponse(conversion));

    await expect(
      createHttpConversionService().convert({ from: 'EUR', to: 'GBP', amount: 100 }),
    ).resolves.toEqual(conversion);

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/convert', {
      method: 'POST',
      signal: undefined,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{"from":"EUR","to":"GBP","amount":100}',
    });
  });
});

describe('createHttpCurrenciesService', () => {
  it('gets /api/v1/currencies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ currencies: [] }));

    await expect(createHttpCurrenciesService().list()).resolves.toEqual({ currencies: [] });

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/currencies', {
      method: 'GET',
      signal: undefined,
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });
});

describe('createHttpHistoryService', () => {
  it('gets /api/v1/history with the requested limit', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    await expect(createHttpHistoryService().recent(5)).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/history?limit=5', {
      method: 'GET',
      signal: undefined,
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });
});

describe('createHttpRatesService', () => {
  it('gets /api/v1/rates', async () => {
    fetchMock.mockResolvedValue(jsonResponse(snapshot));

    await expect(createHttpRatesService().getSnapshot()).resolves.toEqual(snapshot);

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/rates', {
      method: 'GET',
      signal: undefined,
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('refuses a body that is not a snapshot rather than converting from it later', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ source: 'cache', fetchedAt: 12, rates: [] }));

    await expect(createHttpRatesService().getSnapshot()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });

    fetchMock.mockResolvedValue(jsonResponse({ ...snapshot, rates: [{ base: 'USD' }] }));

    await expect(createHttpRatesService().getSnapshot()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });

    fetchMock.mockResolvedValue(
      jsonResponse({
        ...snapshot,
        rates: [{ base: 'USD', quote: 'UAH', buy: '44.35', date: '2026-09-08T11:00:00.000Z' }],
      }),
    );

    await expect(createHttpRatesService().getSnapshot()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('gets /api/v1/rates/history for one pair and window', async () => {
    fetchMock.mockResolvedValue(jsonResponse(series));

    await expect(
      createHttpRatesService().getHistory({ base: 'USD', quote: 'UAH', days: 30 }),
    ).resolves.toEqual(series);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/rates/history?base=USD&quote=UAH&days=30',
      {
        method: 'GET',
        signal: undefined,
        headers: { Accept: 'application/json' },
        body: undefined,
      },
    );
  });

  it('refuses a series it cannot chart rather than drawing an undefined', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...series, days: '30' }));

    await expect(
      createHttpRatesService().getHistory({ base: 'USD', quote: 'UAH', days: 30 }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });

    fetchMock.mockResolvedValue(jsonResponse({ ...series, points: [{ buy: 44.35 }] }));

    await expect(
      createHttpRatesService().getHistory({ base: 'USD', quote: 'UAH', days: 30 }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });

    fetchMock.mockResolvedValue(
      jsonResponse({ ...series, points: [{ date: '2026-09-09', buy: '44.35' }] }),
    );

    await expect(
      createHttpRatesService().getHistory({ base: 'USD', quote: 'UAH', days: 30 }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('createHttpHealthService', () => {
  it('gets /health and returns the terminus report', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'ok', details: { redis: { status: 'up' } } }),
    );

    await expect(createHttpHealthService().report()).resolves.toEqual({
      status: 'ok',
      details: { redis: { status: 'up' } },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/health', {
      method: 'GET',
      signal: undefined,
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('returns the report a degraded API answers 503 with', async () => {
    fetchMock.mockResolvedValue(jsonResponse(degradedReport, 503));

    await expect(createHttpHealthService().report()).resolves.toEqual(degradedReport);
  });

  it('throws on a status that carries no report', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'boom' }, 500),
    );

    const error = await createHttpHealthService()
      .report()
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  it('throws on a transport failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(createHttpHealthService().report()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('throws when the body is not a report', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 503 }));

    await expect(createHttpHealthService().report()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });

    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }));

    await expect(createHttpHealthService().report()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });

    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', details: { redis: 'up' } }));

    await expect(createHttpHealthService().report()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});

describe('createHttpServices', () => {
  it('assembles one implementation per resource', () => {
    const services = createHttpServices();

    expect(Object.keys(services)).toEqual([
      'conversion',
      'currencies',
      'rates',
      'history',
      'health',
    ]);
  });
});
