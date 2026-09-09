import { RetryOptions, retry } from '../retry.util';

interface Harness {
  readonly delays: number[];
  readonly options: RetryOptions;
}

// A deterministic clock and a random that always picks the top of the jitter
// window, so an asserted delay is the exponential window itself.
function harness(overrides: Partial<RetryOptions> = {}): Harness {
  const delays: number[] = [];

  return {
    delays,
    options: {
      attempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      shouldRetry: () => true,
      sleep: (ms) => {
        delays.push(ms);

        return Promise.resolve();
      },
      random: () => 1,
      ...overrides,
    },
  };
}

describe('retry', () => {
  it('returns the first result without sleeping', async () => {
    const { delays, options } = harness();
    const fn = jest.fn().mockResolvedValue('rates');

    await expect(retry(fn, options)).resolves.toBe('rates');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toStrictEqual([]);
  });

  it('retries until an attempt succeeds', async () => {
    const { options } = harness();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValue('rates');

    await expect(retry(fn, options)).resolves.toBe('rates');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('makes exactly `attempts` attempts and rethrows the last error', async () => {
    const { options } = harness({ attempts: 3 });
    const last = new Error('third');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(last);

    await expect(retry(fn, options)).rejects.toBe(last);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('doubles the jitter window on every attempt', async () => {
    const { delays, options } = harness({ attempts: 4, baseDelayMs: 100 });
    const fn = jest.fn().mockRejectedValue(new Error('down'));

    await expect(retry(fn, options)).rejects.toThrow('down');

    expect(delays).toStrictEqual([100, 200, 400]);
  });

  it('caps the window at maxDelayMs', async () => {
    const { delays, options } = harness({
      attempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 150,
    });
    const fn = jest.fn().mockRejectedValue(new Error('down'));

    await expect(retry(fn, options)).rejects.toThrow('down');

    expect(delays).toStrictEqual([100, 150, 150]);
  });

  it('spreads the delay across the window rather than waiting all of it', async () => {
    const { delays, options } = harness({
      attempts: 2,
      baseDelayMs: 100,
      random: () => 0.25,
    });
    const fn = jest.fn().mockRejectedValue(new Error('down'));

    await expect(retry(fn, options)).rejects.toThrow('down');

    expect(delays).toStrictEqual([25]);
  });

  it('gives up immediately on an error shouldRetry rejects', async () => {
    const { delays, options } = harness({ shouldRetry: () => false });
    const fn = jest.fn().mockRejectedValue(new Error('rate limited'));

    await expect(retry(fn, options)).rejects.toThrow('rate limited');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toStrictEqual([]);
  });

  it('consults shouldRetry with the error that was thrown', async () => {
    const shouldRetry = jest.fn().mockReturnValue(false);
    const { options } = harness({ shouldRetry });
    const error = new Error('upstream');

    await expect(retry(() => Promise.reject(error), options)).rejects.toBe(
      error,
    );

    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('still attempts once when asked for fewer than one attempt', async () => {
    const { options } = harness({ attempts: 0 });
    const fn = jest.fn().mockResolvedValue('rates');

    await expect(retry(fn, options)).resolves.toBe('rates');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('sleeps for real when no sleep is injected', async () => {
    jest.useFakeTimers();

    try {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('flaky'))
        .mockResolvedValue('rates');
      const pending = retry(fn, {
        attempts: 2,
        baseDelayMs: 50,
        maxDelayMs: 50,
        shouldRetry: () => true,
      });

      // Let the first rejection settle so the timer the retry schedules exists.
      await Promise.resolve();
      await Promise.resolve();
      jest.runOnlyPendingTimers();

      await expect(pending).resolves.toBe('rates');
    } finally {
      jest.useRealTimers();
    }
  });
});
