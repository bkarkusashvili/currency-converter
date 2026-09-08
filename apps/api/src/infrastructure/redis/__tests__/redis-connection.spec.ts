import { RedisConnection } from '../redis-connection';
import { createFakePinoLogger } from './fake-pino-logger';
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
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED'),
      );
    });
  });

  describe('shutdown', () => {
    it('quits an open connection', async () => {
      const client = new FakeRedisClient();
      const logger = createFakePinoLogger();
      const connection = new RedisConnection(
        client.asRedis(),
        logger.asPinoLogger(),
      );

      await connection.onModuleInit();
      await connection.onModuleDestroy();

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

      await connection.onModuleDestroy();

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
      await connection.onModuleDestroy();

      expect(client.quitCalls).toBe(1);
      expect(client.disconnectCalls).toBe(1);
    });
  });
});
