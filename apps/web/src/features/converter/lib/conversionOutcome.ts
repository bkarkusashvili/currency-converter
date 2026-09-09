import type { QueryStatus } from '@tanstack/react-query';
import type {
  ApiError,
  ConvertRequest,
  ConvertResponse,
  RatesSnapshotResponse,
} from '../../../api';
import { convertOffline } from './convertOffline';
import { OFFLINE_ESTIMATE } from './provenance';

const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
const SERVER_ERROR_CODES: readonly string[] = ['INTERNAL_ERROR', 'RATES_UNAVAILABLE'];
const SERVER_ERROR_STATUS = 500;

/**
 * The failures that say nothing about the request: the transport never reached
 * the API, or the API reached its own limits and answered a 5xx. Everything
 * else — a validation error, an unsupported currency, no rate path, a 401, a
 * 404, a 429 — is an answer, and answering it from a stored snapshot would
 * contradict the service rather than stand in for it.
 */
export function isApiUnreachable(error: ApiError): boolean {
  return (
    error.code === NETWORK_ERROR_CODE ||
    (error.statusCode >= SERVER_ERROR_STATUS && SERVER_ERROR_CODES.includes(error.code))
  );
}

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
  /**
   * Where the snapshot query is. `pending` is not the same as nothing stored:
   * without it a first load says "nothing has been cached" for as long as the
   * request takes, about a browser that may be about to have a snapshot.
   */
  snapshotStatus: QueryStatus;
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
  snapshotStatus,
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
    return {
      outcome: undefined,
      error,
      withoutSnapshot: snapshot === undefined && snapshotStatus !== 'pending',
    };
  }

  return {
    outcome: { ...estimate, source: OFFLINE_ESTIMATE },
    error: null,
    withoutSnapshot: false,
  };
}
