import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { TypedConfigService } from '../../config/typed-config.service';

export function createRedisClient(
  config: TypedConfigService,
  logger: PinoLogger,
): Redis {
  logger.setContext('RedisClient');

  const client = new Redis(config.get('REDIS_URL', { infer: true }), {
    // RedisConnection opens the socket on module init, so nothing is sent
    // before then, and a command issued while the socket is down fails fast
    // instead of queueing up behind a Redis that may never come back.
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // The deadline the other two options do not give: they bound what happens
    // after a socket error, while a command already written to a socket that
    // stops answering has nothing to time it out. The cache sits on the request
    // path, so without this a stalled Redis hangs GET /rates rather than
    // degrading it to an upstream call.
    commandTimeout: config.get('REDIS_COMMAND_TIMEOUT_MS', { infer: true }),
  });

  // Redis is a cache, not a hard dependency: a connection problem degrades the
  // rates lookup and is reported on /health, it does not take the process down.
  // ioredis reconnects on its own and emits an error for every failed attempt,
  // so only the first failure of an outage is worth a warning; repeating it
  // once a second would drown the log for as long as Redis stays down.
  let outageReported = false;

  // The error travels as a pino field rather than interpolated into the
  // sentence: that is what puts a serialised stack in the JSON line instead of
  // one message with the rest of the failure thrown away.
  client.on('error', (error: Error) => {
    if (outageReported) {
      logger.debug({ err: error }, 'Redis reconnect attempt failed');
      return;
    }

    outageReported = true;
    logger.warn({ err: error }, 'Redis connection error');
  });

  client.on('ready', () => {
    if (outageReported) {
      outageReported = false;
      logger.info('Redis connection restored');
    }
  });

  return client;
}
