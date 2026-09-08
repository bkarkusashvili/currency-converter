import { Controller, Get, Inject, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthExceptionFilter } from './health-exception.filter';
import type { HealthIndicatorPort } from './health-indicator.port';
import { HEALTH_INDICATORS } from './health-indicators.token';

@ApiTags('health')
@Controller('health')
// A liveness probe runs far more often than a client and shares the caller's
// bucket, so under the global limit the 61st probe of a minute would answer 429
// and an orchestrator would restart a perfectly healthy process.
@SkipThrottle()
@UseFilters(HealthExceptionFilter)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: readonly HealthIndicatorPort[],
  ) {}

  @Get()
  @HealthCheck()
  @ApiOkResponse({
    description: 'Every registered indicator reports the service as up.',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check(
      this.indicators.map((indicator) => () => indicator.check()),
    );
  }
}
