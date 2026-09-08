import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestId } from './get-request-id';
import { REQUEST_ID_HEADER } from './request-id.constant';
import { sanitiseRequestId } from './sanitise-request-id';

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
