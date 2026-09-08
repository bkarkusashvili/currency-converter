import { IncomingMessage } from 'node:http';
import { getRequestId } from './get-request-id';

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

// pino's default request serializer writes the whole header bag on every line,
// which is roughly 1.5 KB of mostly the CSP echoed back, and puts credentials
// one forgotten redact path away from the log. Projecting the documented fields
// instead means a header can never be logged by accident.
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
