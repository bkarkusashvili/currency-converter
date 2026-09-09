import type { HealthIndicator } from '../../../api';

/** The three states the API's own breaker moves through (docs/architecture.md §6). */
export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const OPEN_REASON = 'circuit open';
const HALF_OPEN_REASON = 'circuit half-open';

/**
 * `/health` reports the Monobank indicator as a status plus a short sanitised
 * reason — `circuit open`, `circuit half-open`, or nothing at all — and never
 * as a state name (§5.3). This reads the state back off those two fields.
 *
 * `null` when the indicator is missing or says something this client has not
 * seen, rather than a guess: an unknown reason is not a closed breaker.
 */
export function breakerState(indicator: HealthIndicator | undefined): BreakerState | null {
  if (indicator === undefined) {
    return null;
  }

  const reason = indicatorReason(indicator);

  if (reason === OPEN_REASON) {
    return 'OPEN';
  }
  if (reason === HALF_OPEN_REASON) {
    return 'HALF_OPEN';
  }

  // Up with nothing to report is the only shape a closed breaker has: the
  // indicator adds a reason for every other state it is in.
  return indicator.status === 'up' && reason === undefined ? 'CLOSED' : null;
}

/**
 * The indicator's own reason, if it sent one. The API picks these strings
 * itself precisely so they are safe to show — a driver message would carry the
 * connection string — but the report is a runtime document, so a value that is
 * not a string is dropped rather than rendered.
 */
export function indicatorReason(indicator: HealthIndicator): string | undefined {
  return typeof indicator.reason === 'string' ? indicator.reason : undefined;
}
