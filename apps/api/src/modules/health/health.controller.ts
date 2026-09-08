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
import { seconds, SkipThrottle, Throttle } from '@nestjs/throttler';
import { HealthExceptionFilter } from './health-exception.filter';
import { HEALTH_INDICATORS } from './health-indicator.port';
import type { HealthIndicatorPort } from './health-indicator.port';

// The dependency report is not exempt, only generous: it runs a Redis PING and
// a Mongo ping per request, so an unauthenticated route with no limit at all is
// an amplifier pointed at both. Well above any monitoring poll rate and still a
// bound.
export const HEALTH_REPORT_LIMIT = 60;
const REPORT_WINDOW_SECONDS = 60;

@ApiTags('health')
@Controller('health')
@UseFilters(HealthExceptionFilter)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(HEALTH_INDICATORS)
    private readonly indicators: readonly HealthIndicatorPort[],
  ) {}

  @Get()
  @HealthCheck()
  @Throttle({
    default: {
      limit: HEALTH_REPORT_LIMIT,
      ttl: seconds(REPORT_WINDOW_SECONDS),
    },
  })
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

  // Liveness, and deliberately nothing else: a check with no indicators answers
  // 200 for as long as the process is up and can serve a request. §3 records
  // why the two are separate — the route above is the dependency report, and
  // gating a deploy on it would let a store that only /history needs fail the
  // rollout of an API that still converts.
  //
  // It runs through Terminus rather than returning a literal so the two routes
  // answer in the same shape, and so a future indicator that genuinely belongs
  // to liveness is one entry away.
  // The exemption belongs to this route alone: a liveness probe runs far more
  // often than a client and shares the caller's bucket, so under the global
  // limit the 61st probe of a minute would answer 429 and an orchestrator would
  // restart a perfectly healthy process. It runs no indicator, so nothing but
  // the process itself is being spent.
  @Get('live')
  @HealthCheck()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Report whether the process is up, regardless of its dependencies',
    description:
      'The liveness probe: it runs no indicator, so it answers 200 whenever ' +
      'the process can serve a request. Deploy gates and container health ' +
      'checks use this one; `/health` is the dependency report for monitoring.',
  })
  @ApiOkResponse({
    description: 'The process is up and serving.',
  })
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
