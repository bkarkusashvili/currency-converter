import { CircuitOpenError } from './circuit-open.error';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  // Injected by the tests so the reset window is asserted on a fake clock.
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private current: CircuitState = 'CLOSED';
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  // An open circuit whose reset window has elapsed reports HALF_OPEN before any
  // trial call arrives: the health indicator should describe what the next call
  // will be allowed to do, not what the last one did.
  get state(): CircuitState {
    return this.current === 'OPEN' && this.hasCooledDown()
      ? 'HALF_OPEN'
      : this.current;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.admit();

    try {
      const result = await fn();
      this.onSuccess();

      return result;
    } catch (error) {
      this.onFailure();

      throw error;
    }
  }

  private admit(): void {
    // HALF_OPEN means the one trial call is in flight; a second caller arriving
    // during it would turn the trial into the flood the breaker exists to stop.
    if (this.current === 'HALF_OPEN') {
      throw new CircuitOpenError('A trial call is already in flight');
    }

    if (this.current === 'OPEN') {
      if (!this.hasCooledDown()) {
        throw new CircuitOpenError();
      }

      this.current = 'HALF_OPEN';
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.current = 'CLOSED';
  }

  private onFailure(): void {
    this.failures += 1;

    if (
      this.current === 'HALF_OPEN' ||
      this.failures >= this.options.failureThreshold
    ) {
      this.current = 'OPEN';
      this.openedAt = this.now();
    }
  }

  private hasCooledDown(): boolean {
    return this.now() - this.openedAt >= this.options.resetTimeoutMs;
  }
}
