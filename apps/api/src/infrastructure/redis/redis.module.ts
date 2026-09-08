import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createRedisClient } from './create-redis-client';
import { REDIS_CLIENT } from './redis-client.token';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: createRedisClient,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    // A lazy client that never opened a socket cannot QUIT: with the offline
    // queue disabled the command is rejected rather than sent.
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
