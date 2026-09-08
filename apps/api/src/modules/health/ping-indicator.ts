import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { TimeoutError } from '../../common/utils/timeout.error';
import { withTimeout } from '../../common/utils/with-timeout';

// `HealthIndicatorService.check` returns the session an indicator reports
// through, and the package does not export its type.
type IndicatorSession = ReturnType<HealthIndicatorService['check']>;

// A probe is not a request. A dependency's own retry window is measured for a
// command a user is waiting on; one that takes a second to answer a ping is
// already down as far as this report is concerned, and waiting for it would
// hold the probe open past the interval an orchestrator polls at.
const PING_TIMEOUT_MS = 500;

// The shape both the Redis and the Mongo indicator have: ping under a budget of
// its own, and report which of the two ways it failed — and nothing else. A
// driver message names the host, the port and, with a password in the url, the
// credentials, and this report is served to anyone who can reach /health.
export async function pingIndicator(
  session: IndicatorSession,
  ping: Promise<unknown>,
): Promise<HealthIndicatorResult> {
  try {
    await withTimeout(ping, PING_TIMEOUT_MS);
  } catch (error) {
    return session.down({
      reason: error instanceof TimeoutError ? 'timeout' : 'ping failed',
    });
  }

  return session.up();
}
