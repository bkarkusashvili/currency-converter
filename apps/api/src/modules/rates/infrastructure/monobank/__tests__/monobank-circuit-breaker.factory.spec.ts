import { CircuitOpenError } from '../../../../../common/resilience/circuit-open.error';
import { fakeConfig } from '../../../../../config/__tests__/fake-config';
import { buildMonobankCircuitBreaker } from '../monobank-circuit-breaker.factory';

const failing = (): Promise<never> =>
  Promise.reject(new Error('upstream down'));

describe('buildMonobankCircuitBreaker', () => {
  // Driven rather than described: the thresholds are only read here, and a
  // spec that read the two numbers back would pass with them wired to the
  // wrong options.
  it('opens after the configured number of consecutive failures', async () => {
    const breaker = buildMonobankCircuitBreaker(
      fakeConfig({
        CIRCUIT_BREAKER_FAILURE_THRESHOLD: 2,
        CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 30_000,
      }),
    );

    await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
    expect(breaker.state).toBe('CLOSED');

    await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
    expect(breaker.state).toBe('OPEN');

    await expect(breaker.execute(failing)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  // The reset window is the other half: an open circuit that never cools down
  // never lets the upstream back in.
  it('allows a trial call once the configured reset window has passed', async () => {
    jest.useFakeTimers();

    try {
      const breaker = buildMonobankCircuitBreaker(
        fakeConfig({
          CIRCUIT_BREAKER_FAILURE_THRESHOLD: 1,
          CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 5_000,
        }),
      );

      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
      expect(breaker.state).toBe('OPEN');

      jest.advanceTimersByTime(5_000);

      expect(breaker.state).toBe('HALF_OPEN');
    } finally {
      jest.useRealTimers();
    }
  });
});
