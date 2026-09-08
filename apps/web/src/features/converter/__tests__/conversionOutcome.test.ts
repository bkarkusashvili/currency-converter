import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { ConvertRequest } from '../../../api/types';
import { isApiUnreachable, resolveConversionOutcome } from '../lib/conversionOutcome';

const request: ConvertRequest = { from: 'USD', to: 'UAH', amount: 100 };

const unreachable = ApiError.network(
  'https://api.test/api/v1/convert',
  new TypeError('Failed to fetch'),
);

/** The conversion failed and there is no snapshot in hand; only the query's state differs. */
function withoutData(snapshotStatus: 'pending' | 'error' | 'success') {
  return resolveConversionOutcome({
    data: undefined,
    error: unreachable,
    request,
    snapshot: undefined,
    snapshotStatus,
  });
}

describe('resolveConversionOutcome', () => {
  it('does not claim nothing was cached while the snapshot is still loading', () => {
    expect(withoutData('pending')).toMatchObject({ outcome: undefined, withoutSnapshot: false });
  });

  it('claims it once the snapshot query has settled with nothing', () => {
    expect(withoutData('error').withoutSnapshot).toBe(true);
  });
});

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
