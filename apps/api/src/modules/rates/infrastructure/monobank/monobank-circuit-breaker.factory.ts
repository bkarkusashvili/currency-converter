import { CircuitBreaker } from '../../../../common/resilience/circuit-breaker';
import type { TypedConfigService } from '../../../../config/typed-config.service';

// The provider and the health indicator have to share one breaker instance:
// an indicator with a breaker of its own would report a circuit nothing trips.
export const MONOBANK_CIRCUIT_BREAKER = Symbol('MONOBANK_CIRCUIT_BREAKER');

// The only place the breaker's thresholds are read from the configuration, so
// it is a function of its own rather than a lambda in the module: what a
// deployment can tune about the upstream's failure handling is stated here.
export function buildMonobankCircuitBreaker(
  config: TypedConfigService,
): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: config.get('CIRCUIT_BREAKER_FAILURE_THRESHOLD', {
      infer: true,
    }),
    resetTimeoutMs: config.get('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', {
      infer: true,
    }),
  });
}
