import { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestId } from './request-id.util';

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

export interface SerializedError {
  type: string;
  message: string;
  code?: string | number;
  status?: number;
  stack?: string;
}

// An axios error carries the whole request that produced it — `config` with the
// url, the headers and any credential in them, plus `request` and the response
// — and pino's default serializer walks all of it onto the line: roughly 4 KB
// for one failed upstream call. Everything an operator reads is in five fields,
// so those are the ones a log line gets, on the same terms as the request and
// response above: what the log documents is projected rather than redacted.
//
// `code` is what the transport failed with (`ECONNREFUSED`, `ETIMEDOUT`) and
// `status` is what the upstream answered with; axios has published `status` on
// the error itself since 1.x and on `response` before that, so both are read.
export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) {
    return { type: typeof error, message: String(error) };
  }

  const { code, status, response } = error as Error & TransportFields;
  const httpStatus = typeof status === 'number' ? status : response?.status;

  return {
    type: error.name,
    message: error.message,
    // Spread rather than assigned undefined: an error that carries no transport
    // code is not one with an empty one.
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    ...(typeof httpStatus === 'number' ? { status: httpStatus } : {}),
    ...(error.stack === undefined ? {} : { stack: error.stack }),
  };
}

// What an axios or a node error adds to Error, read structurally: the logger
// must not import axios to describe a failure that may not come from it.
interface TransportFields {
  code?: unknown;
  status?: unknown;
  response?: { status?: unknown };
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
