import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import type { HealthIndicatorPort } from './health-indicator.port';
import { HEALTH_INDICATORS } from './health-indicators.token';

@ApiTags('health')
@Controller('health')
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
