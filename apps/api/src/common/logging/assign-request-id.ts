import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { REQUEST_ID_HEADER } from './request-id.constant';

// Used as pino-http's genReqId, so the id chosen here is the one every log line
// for this request carries, the one echoed to the caller, and the one the error
// envelope reports. Honouring an inbound id keeps traces joined across services.
export function assignRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const inbound = request.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof inbound === 'string' && inbound.trim().length > 0
      ? inbound.trim()
      : randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}
