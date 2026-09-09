export interface RetryOptions {
  // Total attempts including the first, so 1 disables retrying.
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  // Injected by the tests so the backoff can be asserted without time passing.
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Full jitter: an attempt waits a uniform slice of its exponential window
// rather than the whole window, so callers that failed together do not come
// back together and repeat the thundering herd that caused the failure.
function backoffDelay(
  attempt: number,
  { baseDelayMs, maxDelayMs }: RetryOptions,
  random: () => number,
): number {
  return random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { shouldRetry, sleep = defaultSleep, random = Math.random } = options;
  const attempts = Math.max(1, options.attempts);

  for (let attempt = 0; attempt < attempts - 1; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error)) {
        throw error;
      }

      await sleep(backoffDelay(attempt, options, random));
    }
  }

  // The last attempt is outside the loop: its rejection is the one the caller
  // sees, and there is no unreachable rethrow to keep honest.
  return fn();
}
