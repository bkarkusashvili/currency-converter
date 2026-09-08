import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { RatesModule } from '../rates/rates.module';
import { HealthController } from './health.controller';
import { HEALTH_INDICATORS } from './health-indicators.token';
import type { HealthIndicatorPort } from './health-indicator.port';
import { MongoHealthIndicator } from './mongo-health.indicator';
import { MonobankHealthIndicator } from './monobank-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
  // RatesModule for the breaker the provider trips, not for the provider: the
  // indicator reports that instance's state and never calls the upstream. Which
  // adapter binds the breaker is the rates module's business, so this module
  // takes it from that module's exports rather than reaching into its
  // infrastructure folder. The Mongo connection needs no import at all:
  // MongooseModule registers it globally.
  imports: [TerminusModule, RedisModule, RatesModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    MongoHealthIndicator,
    MonobankHealthIndicator,
    {
      // The token is exactly what is injected into it, so registering an
      // indicator is adding it to this list and nowhere else: the controller
      // runs whatever the token holds and has no reason to change.
      provide: HEALTH_INDICATORS,
      inject: [
        RedisHealthIndicator,
        MongoHealthIndicator,
        MonobankHealthIndicator,
      ],
      useFactory: (
        ...indicators: HealthIndicatorPort[]
      ): HealthIndicatorPort[] => indicators,
    },
  ],
})
export class HealthModule {}
