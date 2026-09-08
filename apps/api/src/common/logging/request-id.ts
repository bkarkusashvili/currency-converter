import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

// The header an id travels in, inbound and outbound.
export const REQUEST_ID_HEADER = 'x-request-id';

// An inbound id is echoed back to the caller and written on every log line for
// the request, so it is bounded and restricted to characters that cannot break
// a log parser or a downstream header. An id that does not qualify is dropped
// rather than truncated: a truncated id would silently merge distinct traces.
const MAX_LENGTH = 128;
const ALLOWED_CHARACTERS = /^[A-Za-z0-9._-]+$/;

export function sanitiseRequestId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.trim();

  if (candidate.length === 0 || candidate.length > MAX_LENGTH) {
    return null;
  }

  return ALLOWED_CHARACTERS.test(candidate) ? candidate : null;
}

// pino-http types `id` as `number | string | object`; assignRequestId only ever
// produces a string, so anything else means the logger middleware did not run.
export function getRequestId(request: IncomingMessage): string | undefined {
  return typeof request.id === 'string' ? request.id : undefined;
}

// The id every log line for this request carries, the one echoed to the caller
// and the one the error envelope reports. Honouring an acceptable inbound id
// keeps a trace joined across services.
//
// Idempotent on purpose: requestIdMiddleware assigns the id before Nest's body
// parser runs, and pino-http's genReqId then reuses what it found rather than
// minting a second one.
export function assignRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const existing = getRequestId(request);

  if (existing !== undefined) {
    return existing;
  }

  const requestId =
    sanitiseRequestId(request.headers[REQUEST_ID_HEADER]) ?? randomUUID();

  request.id = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}

// Registered as the first middleware in configureHttp. Nest installs its body
// parser during init(), which is after everything app.use() put in place but
// before any module middleware, so the pino middleware is too late: a malformed
// JSON body fails in the parser and would answer with an envelope carrying no
// requestId and no matching log line.
export function requestIdMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  assignRequestId(request, response);
  next();
}
