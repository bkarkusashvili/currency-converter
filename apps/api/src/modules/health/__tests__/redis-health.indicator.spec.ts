import { HealthIndicatorService } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { FakeRedisClient } from '../../../infrastructure/redis/__tests__/fake-redis-client';
import { RedisHealthIndicator } from '../redis-health.indicator';

// Longer than any budget the indicator could reasonably use, so the test does
// not encode the constant it is checking the effect of.
const PAST_ANY_BUDGET_MS = 10_000;

function neverAnswers(): Redis {
  return {
    ping: () => new Promise<'PONG'>(() => undefined),
  } as unknown as Redis;
}

function createIndicator(client: Redis): RedisHealthIndicator {
  return new RedisHealthIndicator(client, new HealthIndicatorService());
}

describe('RedisHealthIndicator', () => {
  it('reports a redis that answers PING as up', async () => {
    const client = new FakeRedisClient();
    await client.connect();

    await expect(
      createIndicator(client.asRedis()).check(),
    ).resolves.toStrictEqual({ redis: { status: 'up' } });
  });

  it('reports a redis that rejects the command as down', async () => {
    const client = new FakeRedisClient();

    await expect(
      createIndicator(client.asRedis()).check(),
    ).resolves.toStrictEqual({
      redis: { status: 'down', reason: 'ping failed' },
    });
  });

  it('reports a redis that never answers as down, distinctly', async () => {
    jest.useFakeTimers();

    try {
      const pending = createIndicator(neverAnswers()).check();
      await jest.advanceTimersByTimeAsync(PAST_ANY_BUDGET_MS);

      await expect(pending).resolves.toStrictEqual({
        redis: { status: 'down', reason: 'timeout' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  // The report is public and an ioredis message names the host, the port and,
  // when the url carries one, the password.
  it('never puts the driver message in the report', async () => {
    const client = {
      ping: () =>
        Promise.reject(new Error('connect ECONNREFUSED 10.0.0.4:6379')),
    } as unknown as Redis;

    const result = await createIndicator(client).check();

    expect(JSON.stringify(result)).not.toContain('10.0.0.4');
  });

  // A rejection that is not a HealthCheckError escapes the Terminus
  // aggregation and takes the whole report down with it.
  it('never rejects, whatever the client does', async () => {
    const client = {
      ping: () => Promise.reject(new Error('down')),
    } as unknown as Redis;

    await expect(createIndicator(client).check()).resolves.toMatchObject({
      redis: { status: 'down' },
    });
  });
});
