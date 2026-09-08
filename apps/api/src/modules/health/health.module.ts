import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HEALTH_INDICATORS } from './health-indicators.token';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    // Empty for now. Later PRs swap this for a factory injecting the Redis,
    // Mongo and Monobank indicators; the controller needs no change.
    { provide: HEALTH_INDICATORS, useValue: [] },
  ],
})
export class HealthModule {}
