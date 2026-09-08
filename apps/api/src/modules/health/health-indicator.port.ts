import { HealthIndicatorResult } from '@nestjs/terminus';

// The seam the Redis, Mongo and Monobank indicators plug into. Named with the
// Port suffix to stay distinct from Terminus's own HealthIndicator class.
//
// An implementation reports trouble by rejecting with a Terminus
// HealthCheckError carrying its result: any other rejection escapes the health
// aggregation instead of being collected into the report.
export interface HealthIndicatorPort {
  check(): Promise<HealthIndicatorResult>;
}
