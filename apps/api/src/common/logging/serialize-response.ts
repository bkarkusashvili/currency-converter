import { ServerResponse } from 'node:http';

export interface SerializedResponse {
  statusCode: number;
}

// The counterpart of serializeRequest: pino's default would write every
// response header, and the status is the only part of the response the log
// line documents. pino-http adds responseTime alongside it.
export function serializeResponse(
  response: ServerResponse,
): SerializedResponse {
  return { statusCode: response.statusCode };
}
