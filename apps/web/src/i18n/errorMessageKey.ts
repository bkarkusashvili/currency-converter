/**
 * Every envelope `code` docs/architecture.md §3 defines, in one place so the
 * suite has something to check the dictionary against. `NETWORK_ERROR` is not
 * here because the API never sends it: it is what this client answers with when
 * the request never reached one.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'UNSUPPORTED_CURRENCY',
  'RATE_NOT_AVAILABLE',
  'TOO_MANY_REQUESTS',
  'RATES_UNAVAILABLE',
  'CACHE_UNAVAILABLE',
  'HISTORY_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const ERROR_MESSAGE_KEYS = {
  VALIDATION_ERROR: 'errors.codes.VALIDATION_ERROR',
  UNAUTHORIZED: 'errors.codes.UNAUTHORIZED',
  FORBIDDEN: 'errors.codes.FORBIDDEN',
  NOT_FOUND: 'errors.codes.NOT_FOUND',
  UNSUPPORTED_CURRENCY: 'errors.codes.UNSUPPORTED_CURRENCY',
  RATE_NOT_AVAILABLE: 'errors.codes.RATE_NOT_AVAILABLE',
  TOO_MANY_REQUESTS: 'errors.codes.TOO_MANY_REQUESTS',
  RATES_UNAVAILABLE: 'errors.codes.RATES_UNAVAILABLE',
  CACHE_UNAVAILABLE: 'errors.codes.CACHE_UNAVAILABLE',
  HISTORY_UNAVAILABLE: 'errors.codes.HISTORY_UNAVAILABLE',
  INTERNAL_ERROR: 'errors.codes.INTERNAL_ERROR',
  NETWORK_ERROR: 'errors.codes.NETWORK_ERROR',
} as const satisfies Record<ApiErrorCode | 'NETWORK_ERROR', string>;

export type ErrorMessageKey = (typeof ERROR_MESSAGE_KEYS)[keyof typeof ERROR_MESSAGE_KEYS];

/** Known envelope codes get a translated message; anything else falls back to the server text. */
export function errorMessageKey(code: string): ErrorMessageKey | null {
  return Object.hasOwn(ERROR_MESSAGE_KEYS, code)
    ? ERROR_MESSAGE_KEYS[code as keyof typeof ERROR_MESSAGE_KEYS]
    : null;
}
