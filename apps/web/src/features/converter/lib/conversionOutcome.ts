import type { ApiError } from '../../../api/http/ApiError';
import type { ConvertRequest, ConvertResponse, RatesSnapshotResponse } from '../../../api/types';
import { convertOffline } from './convertOffline';
import { isApiUnreachable } from './isApiUnreachable';
import { OFFLINE_ESTIMATE } from './provenance';

/**
 * The sources the API reports, plus the one the client can produce on its own.
 * Widening this rather than `ConvertResponse['source']` keeps the API contract
 * types describing the API: nothing the server can answer with gains a value
 * only this app knows how to make.
 */
export type ConversionSource = ConvertResponse['source'] | typeof OFFLINE_ESTIMATE;

export interface ConversionOutcome extends Omit<ConvertResponse, 'source'> {
  source: ConversionSource;
}

interface ConversionInput {
  data: ConvertResponse | undefined;
  error: ApiError | null;
  /** The request the mutation carried, which is what an estimate re-prices. */
  request: ConvertRequest | undefined;
  snapshot: RatesSnapshotResponse | undefined;
}

export interface ConversionOutcomeState {
  outcome: ConversionOutcome | undefined;
  error: ApiError | null;
  /** The API was unreachable and this browser has nothing stored to estimate from. */
  withoutSnapshot: boolean;
}

/**
 * What the converter shows after a mutation settles. An unreachable API with a
 * usable snapshot resolves to an estimate instead of an error; anything else
 * keeps the error the API produced, because the API is authoritative whenever
 * it can answer at all.
 */
export function resolveConversionOutcome({
  data,
  error,
  request,
  snapshot,
}: ConversionInput): ConversionOutcomeState {
  if (data !== undefined) {
    return { outcome: data, error: null, withoutSnapshot: false };
  }

  if (error === null || !isApiUnreachable(error)) {
    return { outcome: undefined, error, withoutSnapshot: false };
  }

  const estimate =
    request === undefined || snapshot === undefined ? undefined : convertOffline(request, snapshot);

  if (estimate === undefined) {
    return { outcome: undefined, error, withoutSnapshot: snapshot === undefined };
  }

  return {
    outcome: { ...estimate, source: OFFLINE_ESTIMATE },
    error: null,
    withoutSnapshot: false,
  };
}
