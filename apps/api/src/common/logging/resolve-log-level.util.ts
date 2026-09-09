import { IncomingMessage, ServerResponse } from 'node:http';
import { PROBE_PATHS } from '../http/paths.constants';

// Narrower than pino's LevelWithSilent, which is what pino-http asks for; every
// member here is one of its levels.
type RequestLogLevel = 'error' | 'warn' | 'info' | 'silent';

function pathOf(request: IncomingMessage): string {
  return (request.url ?? '').split('?')[0] ?? '';
}

// pino-http levels every completed request at `info` unless it is told
// otherwise, so a 401, a 429 or a 503 would sit at the same level as a healthy
// 200 and nothing would stand out in an alert.
//
// A successful probe is the opposite problem: it runs every few seconds and
// says nothing. Both are dropped — the liveness route is polled harder than the
// dependency report, not less — and only while they succeed: a failing probe
// still takes the warn or error branch above.
export function resolveLogLevel(
  request: IncomingMessage,
  response: ServerResponse,
  error?: Error,
): RequestLogLevel {
  if (error !== undefined || response.statusCode >= 500) {
    return 'error';
  }

  if (response.statusCode >= 400) {
    return 'warn';
  }

  return PROBE_PATHS.includes(pathOf(request)) ? 'silent' : 'info';
}
