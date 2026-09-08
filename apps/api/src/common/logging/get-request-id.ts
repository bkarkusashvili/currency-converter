import { IncomingMessage } from 'node:http';

// pino-http types `id` as `number | string | object`; assignRequestId only ever
// produces a string, so anything else means the logger middleware did not run.
export function getRequestId(request: IncomingMessage): string | undefined {
  return typeof request.id === 'string' ? request.id : undefined;
}
