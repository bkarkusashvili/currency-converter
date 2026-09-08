import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { MonobankModule } from '../rates/infrastructure/monobank/monobank.module';
import { HealthController } from './health.controller';
import type { HealthIndicatorPort } from './health-indicator.port';
import { HEALTH_INDICATORS } from './health-indicators.token';
import { MonobankHealthIndicator } from './monobank-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

// The token is exactly what is injected into it, so registering an indicator
// is adding it here and nowhere else: the controller runs whatever the list
// holds and has no reason to change.
function collectIndicators(
  ...indicators: HealthIndicatorPort[]
): HealthIndicatorPort[] {
  return indicators;
}

@Module({
  // MonobankModule for the breaker the provider trips, not for the provider:
  // the indicator reports that instance's state and never calls the upstream.
  imports: [TerminusModule, RedisModule, MonobankModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    MonobankHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      inject: [RedisHealthIndicator, MonobankHealthIndicator],
      useFactory: collectIndicators,
    },
  ],
})
export class HealthModule {}
