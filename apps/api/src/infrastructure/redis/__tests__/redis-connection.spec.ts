import { createFakePinoLogger } from '../../../common/logging/__tests__/fake-pino-logger';
import { RedisConnection } from '../redis-connection.provider';
import { FakeRedisClient, OFFLINE_QUEUE_REJECTION } from './fake-redis-client';

describe('RedisConnection', () => {
  describe('against a reachable redis', () => {
    it('leaves the socket closed until the module is initialised', async () => {
      const client = new FakeRedisClient();
      const logger = createFakePinoLogger();

      new RedisConnection(client.asRedis(), logger.asPinoLogger());

      await expect(client.get('rates:latest')).rejects.toThrow(
        OFFLINE_QUEUE_REJECTION,
      );
    });

    it('serves the first command issued after module init', async () => {
      const client = new FakeRedisClient();
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onModuleInit();

      await expect(client.set('rates:latest', '{}')).resolves.toBe('OK');
      await expect(client.get('rates:latest')).resolves.toBe('{}');
    });
  });

  describe('against a redis that is down', () => {
    it('does not fail boot', async () => {
      const client = new FakeRedisClient({ unreachable: true });
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await expect(connection.onModuleInit()).resolves.toBeUndefined();
    });

    it('warns once with the reason instead of throwing', async () => {
      const client = new FakeRedisClient({ unreachable: true });
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onModuleInit();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      // The reason travels as the pino error field, which is what carries a
      // stack into the JSON line; interpolating the message drops it.
      expect(logger.warn).toHaveBeenCalledWith(
        {
          err: expect.objectContaining({
            message: expect.stringContaining('ECONNREFUSED') as string,
          }) as Error,
        },
        expect.stringContaining('starts degraded'),
      );
    });
  });

  describe('shutdown', () => {
    // Nest closes the HTTP listener between the destroy hooks and the shutdown
    // hooks, so a teardown declared as the first one takes the cache away from
    // the requests that are still being served.
    it('tears down after the listener rather than before it', () => {
      const connection = new RedisConnection(
        new FakeRedisClient().asRedis(),
        createFakePinoLogger().asPinoLogger(),
      );

      expect(
        (connection as { onModuleDestroy?: unknown }).onModuleDestroy,
      ).toBeUndefined();
      expect(typeof connection.onApplicationShutdown).toBe('function');
    });

    it('quits an open connection', async () => {
      const client = new FakeRedisClient();
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onModuleInit();
      await connection.onApplicationShutdown();

      expect(client.quitCalls).toBe(1);
      expect(client.status).toBe('end');
    });

    it('drops a client that never opened a socket rather than quitting it', async () => {
      const client = new FakeRedisClient();
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onApplicationShutdown();

      expect(client.quitCalls).toBe(0);
      expect(client.disconnectCalls).toBe(1);
    });

    it('falls back to disconnecting when the quit itself fails', async () => {
      const client = new FakeRedisClient({ quitFails: true });
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onModuleInit();
      await connection.onApplicationShutdown();

      expect(client.quitCalls).toBe(1);
      expect(client.disconnectCalls).toBe(1);
    });
  });
});
