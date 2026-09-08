import type { HealthIndicatorPort } from './health-indicator.port';

// The token is exactly what is injected into it, so registering an indicator is
// adding it to the module's `inject` list and nowhere else: the controller runs
// whatever the list holds and has no reason to change.
export function collectIndicators(
  ...indicators: HealthIndicatorPort[]
): HealthIndicatorPort[] {
  return indicators;
}
