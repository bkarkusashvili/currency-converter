import { IncomingMessage, ServerResponse } from 'node:http';
import { assignRequestId } from './assign-request-id';

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
