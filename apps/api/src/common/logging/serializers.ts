import { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestId } from './request-id';

// What reaches a log line, and nothing else. pino's defaults would write the
// whole header bag on both sides of a request — roughly 1.5 KB of mostly the
// echoed CSP, with credentials one forgotten redact path away — so the fields
// the log documents are projected here instead and a header can never be
// written by accident.

export interface SerializedRequest {
  id: string | undefined;
  method: string | undefined;
  url: string | undefined;
  remoteAddress: string | undefined;
}

// Express adds both, but the logger is handed a plain IncomingMessage.
interface ExpressRequestFields {
  ip?: string;
  originalUrl?: string;
}

export function serializeRequest(request: IncomingMessage): SerializedRequest {
  const { ip, originalUrl } = request as IncomingMessage & ExpressRequestFields;

  return {
    id: getRequestId(request),
    method: request.method,
    // Express rewrites url when a router strips a prefix; originalUrl is the
    // path the client actually asked for.
    url: originalUrl ?? request.url,
    // req.ip honours `trust proxy`, so behind nginx or Railway this is the
    // client rather than the load balancer.
    remoteAddress: ip ?? request.socket?.remoteAddress,
  };
}

export interface SerializedResponse {
  statusCode: number;
}

// The status is the only part of the response the log line documents; pino-http
// adds responseTime alongside it.
export function serializeResponse(
  response: ServerResponse,
): SerializedResponse {
  return { statusCode: response.statusCode };
}

// What the Nest logger takes as its second argument: a stack, as a string. The
// two places that use it are the bootstrap paths, where the pino logger is
// either not resolved yet or being flushed, so `{ err }` is not available and
// the stack has to be spelled out.
export function errorStack(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
