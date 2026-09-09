import type Redis from 'ioredis';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../config/__tests__/fake-config';
import { createRedisClient } from '../create-redis-client.factory';

const COMMAND_TIMEOUT_MS = 300;

describe('createRedisClient', () => {
  let client: Redis;
  let logger: FakePinoLogger;

  beforeEach(() => {
    logger = createFakePinoLogger();
    client = createRedisClient(
      fakeConfig({
        REDIS_URL: 'redis://localhost:6379',
        REDIS_COMMAND_TIMEOUT_MS: COMMAND_TIMEOUT_MS,
      }),
      logger.asPinoLogger(),
    );
  });

  afterEach(() => {
    client.disconnect();
  });

  it('does not open a socket while being constructed, so startup never blocks on redis', () => {
    expect(client.status).toBe('wait');
  });

  it('takes its host and port from the configured url', () => {
    expect(client.options).toMatchObject({ host: 'localhost', port: 6379 });
  });

  // The four options the module's design rests on: RedisConnection opens the
  // socket itself, so the client must not; a command issued while Redis is down
  // has to fail rather than queue behind an outage that may not end; and one
  // sent to a socket that stops answering has to give up on its own.
  it('is lazy, fails a command fast and never buffers one', () => {
    expect(client.options).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: COMMAND_TIMEOUT_MS,
    });
  });

  it('takes the command deadline from the configuration rather than a default', () => {
    const configured = createRedisClient(
      fakeConfig({
        REDIS_URL: 'redis://localhost:6379',
        REDIS_COMMAND_TIMEOUT_MS: 42,
      }),
      logger.asPinoLogger(),
    );

    expect(configured.options).toMatchObject({ commandTimeout: 42 });

    configured.disconnect();
  });

  // The failure travels as a pino field, not inside the sentence: interpolating
  // `error.message` is what drops the stack from the JSON line.
  it('reports a connection error as a warning instead of letting it escape', () => {
    const failure = new Error('ECONNREFUSED');

    expect(() => client.emit('error', failure)).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      { err: failure },
      'Redis connection error',
    );
  });

  it('drops the reconnect attempts that follow to debug rather than warning in a loop', () => {
    client.emit('error', new Error('ECONNREFUSED'));
    client.emit('error', new Error('ECONNREFUSED'));
    client.emit('error', new Error('ECONNREFUSED'));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it('reports the recovery and warns again on the next outage', () => {
    client.emit('error', new Error('ECONNREFUSED'));
    client.emit('ready');
    client.emit('error', new Error('ECONNRESET'));

    expect(logger.info).toHaveBeenCalledWith('Redis connection restored');
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('stays quiet on a ready that did not follow an outage', () => {
    client.emit('ready');

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs under its own context so a redis line is attributable', () => {
    expect(logger.setContext).toHaveBeenCalledWith('RedisClient');
  });
});
