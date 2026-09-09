import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoggingModule } from '../../common/logging/logging.module';
import { createRedisClient, REDIS_CLIENT } from './create-redis-client.factory';
import { RedisConnection } from './redis-connection.provider';

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
