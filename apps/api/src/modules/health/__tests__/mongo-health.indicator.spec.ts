import { HealthIndicatorService } from '@nestjs/terminus';
import type { Connection } from 'mongoose';
import { ConnectionStates } from 'mongoose';
import { FakeMongoConnection } from '../../../infrastructure/mongo/__tests__/fake-mongo-connection';
import { MongoHealthIndicator } from '../mongo-health.indicator';

// Longer than any budget the indicator could reasonably use, so the test does
// not encode the constant it is checking the effect of.
const PAST_ANY_BUDGET_MS = 10_000;

function createIndicator(connection: Connection): MongoHealthIndicator {
  return new MongoHealthIndicator(connection, new HealthIndicatorService());
}

function connected(options?: {
  pingFails?: boolean;
  pingNeverAnswers?: boolean;
}): FakeMongoConnection {
  const connection = new FakeMongoConnection(options);
  connection.settle();

  return connection;
}

describe('MongoHealthIndicator', () => {
  it('reports a database that answers a ping as up', async () => {
    await expect(
      createIndicator(connected().asConnection()).check(),
    ).resolves.toStrictEqual({ mongodb: { status: 'up' } });
  });

  // A conversion is answered while this is down, which is the whole point of
  // reporting it separately: the report says what is degraded, not what failed.
  it('reports a connection that never opened as down', async () => {
    await expect(
      createIndicator(new FakeMongoConnection().asConnection()).check(),
    ).resolves.toStrictEqual({
      mongodb: { status: 'down', reason: 'not connected' },
    });
  });

  it('reports a database that rejects the ping as down', async () => {
    await expect(
      createIndicator(connected({ pingFails: true }).asConnection()).check(),
    ).resolves.toStrictEqual({
      mongodb: { status: 'down', reason: 'ping failed' },
    });
  });

  it('reports a database that never answers as down, distinctly', async () => {
    jest.useFakeTimers();

    try {
      const pending = createIndicator(
        connected({ pingNeverAnswers: true }).asConnection(),
      ).check();
      await jest.advanceTimersByTimeAsync(PAST_ANY_BUDGET_MS);

      await expect(pending).resolves.toStrictEqual({
        mongodb: { status: 'down', reason: 'timeout' },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  // The report is public and a driver message names the host and, when the url
  // carries one, the password.
  it('never puts the driver message in the report', async () => {
    const connection = {
      readyState: ConnectionStates.connected,
      db: {
        admin: () => ({
          ping: () =>
            Promise.reject(
              new Error(
                'failed to connect to mongodb://admin:hunter2@10.0.0.4',
              ),
            ),
        }),
      },
    } as unknown as Connection;

    const result = await createIndicator(connection).check();

    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(JSON.stringify(result)).not.toContain('10.0.0.4');
  });

  // A rejection that is not a HealthCheckError escapes the Terminus aggregation
  // and takes the whole report down with it.
  it('never rejects, whatever the driver does', async () => {
    const connection = {
      readyState: ConnectionStates.connected,
      db: {
        admin: () => ({
          ping: () => Promise.reject(new Error('topology destroyed')),
        }),
      },
    } as unknown as Connection;

    await expect(createIndicator(connection).check()).resolves.toMatchObject({
      mongodb: { status: 'down' },
    });
  });
});
