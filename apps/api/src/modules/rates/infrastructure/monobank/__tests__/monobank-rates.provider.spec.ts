import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../../common/logging/__tests__/fake-pino-logger';
import { CircuitBreaker } from '../../../../../common/resilience/circuit-breaker';
import { CircuitOpenError } from '../../../../../common/resilience/circuit-open.error';
import type { TypedConfigService } from '../../../../../config/typed-config.service';
import { MonobankRatesProvider } from '../monobank-rates.provider';

const API_URL = 'https://api.monobank.ua/bank/currency';
const FAILURE_THRESHOLD = 2;

const USD_UAH = {
  currencyCodeA: 840,
  currencyCodeB: 980,
  date: 1_757_332_800,
  rateBuy: 44.35,
  rateSell: 44.831,
};

function response(data: unknown): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function axiosFailure(status?: number): AxiosError {
  const error = new AxiosError('Request failed', 'ECONNABORTED');

  if (status !== undefined) {
    error.response = {
      status,
      statusText: '',
      data: undefined,
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    };
  }

  return error;
}

describe('MonobankRatesProvider', () => {
  let get: jest.Mock;
  let breaker: CircuitBreaker;
  let logger: FakePinoLogger;
  let provider: MonobankRatesProvider;

  beforeEach(() => {
    get = jest.fn();
    breaker = new CircuitBreaker({
      failureThreshold: FAILURE_THRESHOLD,
      resetTimeoutMs: 30_000,
    });
    logger = createFakePinoLogger();

    const config = {
      get: (key: string): unknown =>
        ({
          MONOBANK_API_URL: API_URL,
          MONOBANK_RETRY_ATTEMPTS: 3,
          // Real sleeps, kept to a millisecond so the suite does not wait.
          MONOBANK_RETRY_BASE_DELAY_MS: 1,
        })[key],
    } as unknown as TypedConfigService;

    provider = new MonobankRatesProvider(
      { get } as unknown as HttpService,
      config,
      breaker,
      logger.asPinoLogger(),
    );
  });

  it('requests the configured url and maps the payload into a snapshot', async () => {
    get.mockReturnValue(of(response([USD_UAH])));

    const snapshot = await provider.fetchRates();

    expect(get).toHaveBeenCalledWith(API_URL);
    expect(snapshot.rates).toStrictEqual([
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        sell: 44.831,
        cross: undefined,
        date: '2025-09-08T12:00:00.000Z',
      },
    ]);
    expect(Date.parse(snapshot.fetchedAt)).not.toBeNaN();
  });

  it('stamps the snapshot with the time of the fetch', async () => {
    get.mockReturnValue(of(response([USD_UAH])));
    const before = Date.now();

    const { fetchedAt } = await provider.fetchRates();

    expect(Date.parse(fetchedAt)).toBeGreaterThanOrEqual(before);
  });

  it('retries a 500 and answers from the attempt that succeeds', async () => {
    get
      .mockReturnValueOnce(throwError(() => axiosFailure(500)))
      .mockReturnValueOnce(of(response([USD_UAH])));

    await expect(provider.fetchRates()).resolves.toMatchObject({
      rates: [{ base: 'USD' }],
    });

    expect(get).toHaveBeenCalledTimes(2);
  });

  it('retries a call that never got a response', async () => {
    get
      .mockReturnValueOnce(throwError(() => axiosFailure()))
      .mockReturnValueOnce(of(response([USD_UAH])));

    await expect(provider.fetchRates()).resolves.toMatchObject({
      rates: [{ base: 'USD' }],
    });
  });

  it('never retries a 429, because the upstream allows one request a minute', async () => {
    get.mockReturnValue(throwError(() => axiosFailure(429)));

    await expect(provider.fetchRates()).rejects.toBeInstanceOf(AxiosError);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('never retries a payload it could not parse', async () => {
    get.mockReturnValue(of(response([{ currencyCodeA: 'USD' }])));

    await expect(provider.fetchRates()).rejects.toThrow();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('counts one breaker failure per exhausted call, not one per attempt', async () => {
    get.mockReturnValue(throwError(() => axiosFailure(500)));

    await expect(provider.fetchRates()).rejects.toBeInstanceOf(AxiosError);

    expect(get).toHaveBeenCalledTimes(3);
    expect(breaker.state).toBe('CLOSED');
  });

  it('opens the circuit at the threshold and then fails without calling out', async () => {
    get.mockReturnValue(throwError(() => axiosFailure(429)));

    for (let call = 0; call < FAILURE_THRESHOLD; call += 1) {
      await expect(provider.fetchRates()).rejects.toBeInstanceOf(AxiosError);
    }

    expect(breaker.state).toBe('OPEN');
    get.mockClear();

    await expect(provider.fetchRates()).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    expect(get).not.toHaveBeenCalled();
  });
});
