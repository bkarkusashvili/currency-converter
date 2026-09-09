import { isAxiosError } from 'axios';

const SERVER_ERROR_FLOOR = 500;

// A response that arrived decides by status: a 5xx is the upstream failing at
// something it may recover from within a second, while 429 and every other 4xx
// is the upstream telling us not to ask again — and Monobank allows one request
// a minute, so retrying a 429 is how a short block becomes a long one. Those
// fall through to the stale cache instead.
//
// No response means the request never completed: a socket error, or the
// ECONNABORTED the per-request timeout raises. That is worth another attempt.
//
// Anything that is not an axios error is a payload we could not parse, and it
// will not parse the second time either.
export function shouldRetryMonobank(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status === undefined || status >= SERVER_ERROR_FLOOR;
}
