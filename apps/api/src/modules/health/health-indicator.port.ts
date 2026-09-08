import { HealthIndicatorResult } from '@nestjs/terminus';

// The seam the Redis, Mongo and Monobank indicators plug into. Named with the
// Port suffix to stay distinct from Terminus's own HealthIndicator class.
//
// An implementation reports trouble by rejecting with a Terminus
// HealthCheckError carrying its result: any other rejection escapes the health
// aggregation instead of being collected into the report.
//
// The report is public, so an implementation reports a status and, when it is
// down, a short sanitised reason it chose itself, never a driver message: a
// Redis or Mongo connection failure carries the connection string, credentials
// included, in the text it throws.
export interface HealthIndicatorPort {
  check(): Promise<HealthIndicatorResult>;
}
