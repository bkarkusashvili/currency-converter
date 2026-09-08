import type Redis from 'ioredis';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../common/logging/__tests__/fake-pino-logger';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { createRedisClient } from '../create-redis-client';

function createConfig(redisUrl: string): TypedConfigService {
  return { get: () => redisUrl } as unknown as TypedConfigService;
}

describe('createRedisClient', () => {
  let client: Redis;
  let logger: FakePinoLogger;

  beforeEach(() => {
    logger = createFakePinoLogger();
    client = createRedisClient(
      createConfig('redis://localhost:6379'),
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

  // The three options the module's design rests on: RedisConnection opens the
  // socket itself, so the client must not, and a command issued while Redis is
  // down has to fail rather than queue behind an outage that may not end.
  it('is lazy, fails a command fast and never buffers one', () => {
    expect(client.options).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  });

  it('reports a connection error as a warning instead of letting it escape', () => {
    expect(() => client.emit('error', new Error('ECONNREFUSED'))).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      'Redis connection error: ECONNREFUSED',
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
