import { TimeoutError } from '../timeout.error';
import { withTimeout } from '../with-timeout';

const TIMEOUT_MS = 20;

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe('withTimeout', () => {
  it('answers with the work when it finishes inside the budget', async () => {
    await expect(
      withTimeout(Promise.resolve('pong'), TIMEOUT_MS),
    ).resolves.toBe('pong');
  });

  it('rejects with a TimeoutError when the work outlives the budget', async () => {
    await expect(
      withTimeout(after(TIMEOUT_MS * 5, 'pong'), TIMEOUT_MS),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('names the budget it gave up on', async () => {
    await expect(
      withTimeout(after(TIMEOUT_MS * 5, 'pong'), TIMEOUT_MS),
    ).rejects.toThrow(`Timed out after ${TIMEOUT_MS}ms`);
  });

  // A failure inside the budget is the work's own, and a caller distinguishing
  // the two has to see it rather than a timeout.
  it('passes a rejection of the work through untouched', async () => {
    const failure = new Error('connect ECONNREFUSED');

    await expect(withTimeout(Promise.reject(failure), TIMEOUT_MS)).rejects.toBe(
      failure,
    );
  });

  // A pending timer holds the event loop open. Jest's fake clock is what makes
  // "the timer is gone" observable rather than a claim.
  it('clears the timer once the work has answered', async () => {
    jest.useFakeTimers();

    try {
      await withTimeout(Promise.resolve('pong'), TIMEOUT_MS);

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears the timer once the work has failed', async () => {
    jest.useFakeTimers();

    try {
      await expect(
        withTimeout(Promise.reject(new Error('down')), TIMEOUT_MS),
      ).rejects.toThrow('down');

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
