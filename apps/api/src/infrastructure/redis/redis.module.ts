import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoggingModule } from '../../common/logging/logging.module';
import { createRedisClient } from './create-redis-client';
import { REDIS_CLIENT } from './redis-client.token';
import { RedisConnection } from './redis-connection';

@Module({
  imports: [LoggingModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService, PinoLogger],
      useFactory: createRedisClient,
    },
    RedisConnection,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
