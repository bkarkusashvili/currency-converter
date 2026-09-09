import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { createOutageReporter } from '../../common/logging/outage-reporter.factory';
import type { TypedConfigService } from '../../config/typed-config.service';

// The injection token for the client this factory builds. One connection is
// shared by the cache adapter, the health indicator and the connection manager.
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

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
  const outage = createOutageReporter(logger, {
    down: 'Redis connection error',
    stillDown: 'Redis reconnect attempt failed',
    restored: 'Redis connection restored',
  });

  client.on('error', (error: Error) => {
    outage.report(error);
  });

  client.on('ready', () => {
    outage.clear();
  });

  return client;
}
