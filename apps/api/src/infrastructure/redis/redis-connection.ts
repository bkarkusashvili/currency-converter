import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { REDIS_CLIENT } from './redis-client.token';

@Injectable()
export class RedisConnection implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisConnection.name);
  }

  // The client is lazy and its offline queue is disabled, so a command issued
  // before the socket is open is rejected rather than buffered. Opening it here
  // is what lets the first cache read of the process reach a healthy Redis.
  // A Redis that is down only degrades the cache, so a failure here is logged
  // and boot continues; ioredis keeps retrying in the background.
  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Redis connection established');
    } catch (error) {
      this.logger.warn(
        `Redis is unavailable at startup, the cache starts degraded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // A shutdown hook rather than a destroy hook: Nest closes the HTTP listener
  // in `dispose()`, which runs after every `onModuleDestroy` and before every
  // `onApplicationShutdown`. Quitting here is what keeps the requests still in
  // flight during a rolling deploy from losing the cache under them.
  async onApplicationShutdown(): Promise<void> {
    // A client that never opened a socket cannot QUIT: with the offline queue
    // disabled the command is rejected rather than sent.
    if (this.client.status === 'wait' || this.client.status === 'end') {
      this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
