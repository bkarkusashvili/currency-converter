import { IncomingMessage, ServerResponse } from 'node:http';
import { resolveLogLevel } from '../resolve-log-level';

function createRequest(url: string): IncomingMessage {
  return { url } as unknown as IncomingMessage;
}

function createResponse(statusCode: number): ServerResponse {
  return { statusCode } as unknown as ServerResponse;
}

function levelFor(url: string, statusCode: number, error?: Error): string {
  return resolveLogLevel(createRequest(url), createResponse(statusCode), error);
}

describe('resolveLogLevel', () => {
  it.each([500, 502, 503])('logs %d at error', (statusCode) => {
    expect(levelFor('/api/v1/convert', statusCode)).toBe('error');
  });

  it.each([400, 401, 404, 422, 429])('logs %d at warn', (statusCode) => {
    expect(levelFor('/api/v1/convert', statusCode)).toBe('warn');
  });

  it.each([200, 201, 204, 304])('logs %d at info', (statusCode) => {
    expect(levelFor('/api/v1/convert', statusCode)).toBe('info');
  });

  it('logs at error when the request threw, whatever the status says', () => {
    expect(levelFor('/api/v1/convert', 200, new Error('socket hang up'))).toBe(
      'error',
    );
  });

  it('drops a successful liveness probe so it does not bury the traffic', () => {
    expect(levelFor('/health', 200)).toBe('silent');
  });

  it('keeps dropping it when the probe carries a query string', () => {
    expect(levelFor('/health?verbose=1', 200)).toBe('silent');
  });

  it('reports a failing liveness probe rather than dropping it', () => {
    expect(levelFor('/health', 503)).toBe('error');
  });

  it('does not drop a route that merely starts like the probe', () => {
    expect(levelFor('/health-check', 200)).toBe('info');
  });
});
