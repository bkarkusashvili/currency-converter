import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { Observable, of, throwError } from 'rxjs';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../../common/logging/__tests__/fake-pino-logger';
import { CircuitBreaker } from '../../../../../common/resilience/circuit-breaker.util';
import { CircuitOpenError } from '../../../../../common/resilience/circuit-open.error';
import { TimeoutError } from '../../../../../common/utils/timeout.error';
import { fakeConfig } from '../../../../../config/__tests__/fake-config';
import { MonobankRatesProvider } from '../monobank-rates.provider';

const API_URL = 'https://api.monobank.ua/bank/currency';
const FAILURE_THRESHOLD = 2;
const TOTAL_BUDGET_MS = 8000;

const config = fakeConfig({
  MONOBANK_API_URL: API_URL,
  MONOBANK_RETRY_ATTEMPTS: 3,
  // Real sleeps, kept to a millisecond so the suite does not wait.
  MONOBANK_RETRY_BASE_DELAY_MS: 1,
  MONOBANK_TOTAL_BUDGET_MS: TOTAL_BUDGET_MS,
});

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

  function buildProvider(withBreaker: CircuitBreaker): MonobankRatesProvider {
    return new MonobankRatesProvider(
      { get } as unknown as HttpService,
      config,
      withBreaker,
      logger.asPinoLogger(),
    );
  }

  beforeEach(() => {
    get = jest.fn();
    breaker = new CircuitBreaker({
      failureThreshold: FAILURE_THRESHOLD,
      resetTimeoutMs: 30_000,
    });
    logger = createFakePinoLogger();
    provider = buildProvider(breaker);
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

  // MONOBANK_TIMEOUT_MS bounds one request, so a call that keeps failing slowly
  // costs the attempts plus the backoff between them, and single-flight makes
  // every concurrent caller wait out the same sum for a stale copy that was
  // already in Redis. The budget is what ends that wait.
  it('gives up on the whole call once the budget is spent', async () => {
    jest.useFakeTimers();

    try {
      // Never emits and never completes: the upstream that accepted the
      // request and answers nothing, which no per-request timeout here sees.
      get.mockReturnValue(new Observable<never>(() => undefined));

      const pending = provider.fetchRates();
      const rejection = expect(pending).rejects.toBeInstanceOf(TimeoutError);

      await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS);
      await rejection;

      expect(get).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  // Inside the breaker rather than around it: a budget that expired is the
  // upstream being unusable, and a circuit that never hears about it keeps
  // sending callers into the same wait.
  it('counts an expired budget as one breaker failure', async () => {
    jest.useFakeTimers();

    try {
      const oneStrike = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 30_000,
      });
      get.mockReturnValue(new Observable<never>(() => undefined));

      const rejection = expect(
        buildProvider(oneStrike).fetchRates(),
      ).rejects.toBeInstanceOf(TimeoutError);

      await jest.advanceTimersByTimeAsync(TOTAL_BUDGET_MS);
      await rejection;

      expect(oneStrike.state).toBe('OPEN');
    } finally {
      jest.useRealTimers();
    }
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
