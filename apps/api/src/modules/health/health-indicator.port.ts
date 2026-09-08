import { HealthIndicatorResult } from '@nestjs/terminus';

// The seam the Redis, Mongo and Monobank indicators plug into. Named with the
// Port suffix to stay distinct from Terminus's own HealthIndicator class.
//
// An implementation reports trouble by resolving with a result whose status is
// down, which HealthIndicatorService builds; Terminus collects it into the
// report beside the healthy ones. A rejection is only collected when it is a
// Terminus HealthCheckError — anything else escapes the aggregation and takes
// the whole check with it, so an implementation catches its own failures.
//
// The report is public, so an implementation reports a status and, when it is
// down, a short sanitised reason it chose itself, never a driver message: a
// Redis or Mongo connection failure carries the connection string, credentials
// included, in the text it throws.
export interface HealthIndicatorPort {
  check(): Promise<HealthIndicatorResult>;
}
