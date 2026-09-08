import { HealthIndicatorResult } from '@nestjs/terminus';

// The seam the Redis, Mongo and Monobank indicators plug into. Named with the
// Port suffix to keep it distinct from Terminus's own HealthIndicator class.
export interface HealthIndicatorPort {
  check(): Promise<HealthIndicatorResult>;
}
