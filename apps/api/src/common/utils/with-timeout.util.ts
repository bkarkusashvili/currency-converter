import { TimeoutError } from './timeout.error';

// Bounds work that has no deadline of its own. The timer is always cleared:
// a pending setTimeout holds the event loop open, so leaving one behind on the
// path that resolved would keep a process from exiting for the whole budget.
//
// Losing the race does not cancel the work, it only stops waiting for it. That
// is the right trade for a probe, where a slow dependency is a down one and the
// answer must not wait for the driver's own retries.
export function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([work, expiry]).finally(() => {
    clearTimeout(timer);
  });
}
