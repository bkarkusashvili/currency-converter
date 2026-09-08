import { Controller, Get, Inject, UseFilters } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Report whether the service and its dependencies are healthy',
  })
  @ApiOkResponse({
    description: 'Every registered indicator reports the service as up.',
  })
  @ApiServiceUnavailableResponse({
    description:
      'At least one indicator is down. This route answers with the Terminus ' +
      'report rather than the error envelope, so which dependency failed ' +
      'stays visible.',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check(
      this.indicators.map((indicator) => () => indicator.check()),
    );
  }
}
