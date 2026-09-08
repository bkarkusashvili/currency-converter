import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { TypedConfigService } from '../../config/typed-config.service';

export function createRedisClient(config: TypedConfigService): Redis {
  const logger = new Logger('RedisClient');

  const client = new Redis(config.get('REDIS_URL', { infer: true }), {
    // The cache must never delay or fail startup, and a command issued while
    // the socket is down should fail fast rather than queue up behind it.
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  // Redis is a cache, not a hard dependency: a connection problem degrades the
  // rates lookup and is reported on /health, it does not take the process down.
  client.on('error', (error: Error) => {
    logger.warn(`Redis connection error: ${error.message}`);
  });

  return client;
}
