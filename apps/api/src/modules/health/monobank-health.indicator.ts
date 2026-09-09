import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { CircuitBreaker } from '../../common/resilience/circuit-breaker.util';
import { MONOBANK_CIRCUIT_BREAKER } from '../rates/infrastructure/monobank/monobank-circuit-breaker.factory';
import { HealthIndicatorPort } from './health-indicator.interface';

const INDICATOR_KEY = 'monobank';

// Reports the breaker rather than the upstream. Monobank allows one request a
// minute and a liveness probe runs far more often than that, so a probe that
// called out would spend the budget the rates lookup depends on and manufacture
// the outage it was checking for. The breaker already knows what the last real
// calls did, and it is the instance the provider trips.
@Injectable()
export class MonobankHealthIndicator implements HealthIndicatorPort {
  constructor(
    @Inject(MONOBANK_CIRCUIT_BREAKER) private readonly breaker: CircuitBreaker,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): Promise<HealthIndicatorResult> {
    return Promise.resolve(this.report());
  }

  // Half open is up: the next call is allowed through, and a stale cache is
  // still answering in the meantime. Only an open circuit is a refusal.
  private report(): HealthIndicatorResult {
    const indicator = this.health.check(INDICATOR_KEY);
    const state = this.breaker.state;

    if (state === 'OPEN') {
      return indicator.down({ reason: 'circuit open' });
    }

    return state === 'HALF_OPEN'
      ? indicator.up({ reason: 'circuit half-open' })
      : indicator.up();
  }
}
