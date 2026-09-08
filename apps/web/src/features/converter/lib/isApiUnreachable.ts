import type { ApiError } from '../../../api/http/ApiError';

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
