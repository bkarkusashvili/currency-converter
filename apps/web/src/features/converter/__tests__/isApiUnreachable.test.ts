import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import { isApiUnreachable } from '../lib/isApiUnreachable';

function failure(statusCode: number, code: string): ApiError {
  return new ApiError({ statusCode, code, message: 'failed' });
}

describe('isApiUnreachable', () => {
  it('is true for a transport failure and for the API failing on its own side', () => {
    expect(isApiUnreachable(ApiError.network('https://api.test', new TypeError('failed')))).toBe(
      true,
    );
    expect(isApiUnreachable(failure(500, 'INTERNAL_ERROR'))).toBe(true);
    expect(isApiUnreachable(failure(503, 'RATES_UNAVAILABLE'))).toBe(true);
  });

  it('is false for every answer that describes the request', () => {
    expect(isApiUnreachable(failure(400, 'VALIDATION_ERROR'))).toBe(false);
    expect(isApiUnreachable(failure(401, 'UNAUTHORIZED'))).toBe(false);
    expect(isApiUnreachable(failure(404, 'NOT_FOUND'))).toBe(false);
    expect(isApiUnreachable(failure(422, 'UNSUPPORTED_CURRENCY'))).toBe(false);
    expect(isApiUnreachable(failure(422, 'RATE_NOT_AVAILABLE'))).toBe(false);
    expect(isApiUnreachable(failure(429, 'TOO_MANY_REQUESTS'))).toBe(false);
  });

  it('is false for a 4xx that carries a code a 5xx would also use', () => {
    // §3: a 4xx never answers INTERNAL_ERROR, but a body this client could not
    // read is reported with the status it arrived on.
    expect(isApiUnreachable(failure(400, 'INTERNAL_ERROR'))).toBe(false);
  });
});
