const ERROR_MESSAGE_KEYS = {
  VALIDATION_ERROR: 'errors.codes.VALIDATION_ERROR',
  UNAUTHORIZED: 'errors.codes.UNAUTHORIZED',
  NOT_FOUND: 'errors.codes.NOT_FOUND',
  UNSUPPORTED_CURRENCY: 'errors.codes.UNSUPPORTED_CURRENCY',
  RATE_NOT_AVAILABLE: 'errors.codes.RATE_NOT_AVAILABLE',
  TOO_MANY_REQUESTS: 'errors.codes.TOO_MANY_REQUESTS',
  RATES_UNAVAILABLE: 'errors.codes.RATES_UNAVAILABLE',
  INTERNAL_ERROR: 'errors.codes.INTERNAL_ERROR',
  NETWORK_ERROR: 'errors.codes.NETWORK_ERROR',
} as const;

export type ErrorMessageKey = (typeof ERROR_MESSAGE_KEYS)[keyof typeof ERROR_MESSAGE_KEYS];

/** Known envelope codes get a translated message; anything else falls back to the server text. */
export function errorMessageKey(code: string): ErrorMessageKey | null {
  return Object.hasOwn(ERROR_MESSAGE_KEYS, code)
    ? ERROR_MESSAGE_KEYS[code as keyof typeof ERROR_MESSAGE_KEYS]
    : null;
}
