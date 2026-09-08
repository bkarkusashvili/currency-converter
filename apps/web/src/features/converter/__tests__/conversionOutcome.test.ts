import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { ConvertRequest } from '../../../api/types';
import { resolveConversionOutcome } from '../lib/conversionOutcome';

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
