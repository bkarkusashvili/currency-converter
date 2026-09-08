import { CircuitBreaker } from '../circuit-breaker';
import { CircuitOpenError } from '../circuit-open.error';

const RESET_TIMEOUT_MS = 1000;

class FakeClock {
  private value = 0;

  now = (): number => this.value;

  advance(ms: number): void {
    this.value += ms;
  }
}

function failing(): Promise<never> {
  return Promise.reject(new Error('upstream down'));
}

describe('CircuitBreaker', () => {
  let clock: FakeClock;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    clock = new FakeClock();
    breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: RESET_TIMEOUT_MS,
      now: clock.now,
    });
  });

  async function trip(): Promise<void> {
    await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
    await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
  }

  describe('closed', () => {
    it('starts closed and passes results through', async () => {
      expect(breaker.state).toBe('CLOSED');
      await expect(
        breaker.execute(() => Promise.resolve('rates')),
      ).resolves.toBe('rates');
      expect(breaker.state).toBe('CLOSED');
    });

    it('rethrows the failure it counts', async () => {
      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');

      expect(breaker.state).toBe('CLOSED');
    });

    it('stays closed while failures are not consecutive', async () => {
      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
      await expect(
        breaker.execute(() => Promise.resolve('rates')),
      ).resolves.toBe('rates');
      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');

      expect(breaker.state).toBe('CLOSED');
    });
  });

  describe('open', () => {
    it('opens on the failure that reaches the threshold', async () => {
      await trip();

      expect(breaker.state).toBe('OPEN');
    });

    it('rejects without calling through while open', async () => {
      await trip();
      const fn = jest.fn();

      await expect(breaker.execute(fn)).rejects.toBeInstanceOf(
        CircuitOpenError,
      );

      expect(fn).not.toHaveBeenCalled();
    });

    it('stays open until the reset timeout has fully elapsed', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS - 1);

      expect(breaker.state).toBe('OPEN');
      await expect(breaker.execute(jest.fn())).rejects.toBeInstanceOf(
        CircuitOpenError,
      );
    });
  });

  describe('half open', () => {
    it('reports half open once the reset timeout has elapsed', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS);

      expect(breaker.state).toBe('HALF_OPEN');
    });

    it('lets a single trial call through', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS);
      const fn = jest.fn().mockResolvedValue('rates');

      await expect(breaker.execute(fn)).resolves.toBe('rates');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('rejects a second caller while the trial is in flight', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS);

      let release = (): void => undefined;
      const trial = breaker.execute(
        () =>
          new Promise<string>((resolve) => (release = () => resolve('rates'))),
      );
      const concurrent = breaker.execute(jest.fn());

      await expect(concurrent).rejects.toBeInstanceOf(CircuitOpenError);

      release();
      await expect(trial).resolves.toBe('rates');
    });

    it('closes and forgets the earlier failures when the trial succeeds', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS);

      await expect(
        breaker.execute(() => Promise.resolve('rates')),
      ).resolves.toBe('rates');

      expect(breaker.state).toBe('CLOSED');

      // One failure would reopen it if the counter had survived the trial.
      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');
      expect(breaker.state).toBe('CLOSED');
    });

    it('reopens on a failed trial and starts the window again', async () => {
      await trip();
      clock.advance(RESET_TIMEOUT_MS);

      await expect(breaker.execute(failing)).rejects.toThrow('upstream down');

      expect(breaker.state).toBe('OPEN');

      clock.advance(RESET_TIMEOUT_MS - 1);
      expect(breaker.state).toBe('OPEN');

      clock.advance(1);
      expect(breaker.state).toBe('HALF_OPEN');
    });
  });

  it('uses the wall clock when none is injected', async () => {
    const wallClock = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 0,
    });

    await expect(wallClock.execute(failing)).rejects.toThrow('upstream down');

    // A zero reset window has elapsed by the time the next call arrives.
    expect(wallClock.state).toBe('HALF_OPEN');
  });
});
