import { HealthIndicatorService } from '@nestjs/terminus';
import { CircuitBreaker } from '../../../common/resilience/circuit-breaker';
import { MonobankHealthIndicator } from '../monobank-health.indicator';

const FAILURE_THRESHOLD = 2;
const RESET_TIMEOUT_MS = 30_000;

async function fail(breaker: CircuitBreaker, times: number): Promise<void> {
  for (let call = 0; call < times; call += 1) {
    await breaker
      .execute(() => Promise.reject(new Error('upstream down')))
      .catch(() => undefined);
  }
}

describe('MonobankHealthIndicator', () => {
  let now: number;
  let breaker: CircuitBreaker;
  let indicator: MonobankHealthIndicator;

  beforeEach(() => {
    now = 0;
    breaker = new CircuitBreaker({
      failureThreshold: FAILURE_THRESHOLD,
      resetTimeoutMs: RESET_TIMEOUT_MS,
      now: () => now,
    });
    indicator = new MonobankHealthIndicator(
      breaker,
      new HealthIndicatorService(),
    );
  });

  it('reports a closed circuit as up, without a reason to explain', async () => {
    await expect(indicator.check()).resolves.toStrictEqual({
      monobank: { status: 'up' },
    });
  });

  it('reports an open circuit as down and says why', async () => {
    await fail(breaker, FAILURE_THRESHOLD);

    await expect(indicator.check()).resolves.toStrictEqual({
      monobank: { status: 'down', reason: 'circuit open' },
    });
  });

  // The next call is allowed through and the stale cache is answering in the
  // meantime, so a recovering upstream is not a failing service.
  it('reports a cooled down circuit as up while naming the trial', async () => {
    await fail(breaker, FAILURE_THRESHOLD);
    now += RESET_TIMEOUT_MS;

    await expect(indicator.check()).resolves.toStrictEqual({
      monobank: { status: 'up', reason: 'circuit half-open' },
    });
  });

  // Monobank allows one request a minute and a liveness probe runs every few
  // seconds, so a probe that called out would manufacture the outage it checks.
  it('never spends the upstream budget it is reporting on', async () => {
    const execute = jest.spyOn(breaker, 'execute');

    await indicator.check();

    expect(execute).not.toHaveBeenCalled();
  });

  it('recovers to a plain up once a call has succeeded', async () => {
    await fail(breaker, FAILURE_THRESHOLD);
    now += RESET_TIMEOUT_MS;
    await breaker.execute(() => Promise.resolve('ok'));

    await expect(indicator.check()).resolves.toStrictEqual({
      monobank: { status: 'up' },
    });
  });
});
