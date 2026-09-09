import { IncomingMessage, ServerResponse } from 'node:http';
import {
  errorStack,
  serializeRequest,
  serializeResponse,
} from '../serializers.util';

interface RequestFields {
  id?: string;
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  headers?: Record<string, string>;
  remoteAddress?: string;
}

function createRequest(fields: RequestFields): IncomingMessage {
  const { remoteAddress, ...rest } = fields;

  return {
    headers: {},
    ...rest,
    socket: { remoteAddress },
  } as unknown as IncomingMessage;
}

describe('serializeRequest', () => {
  it('reports the id, method, url and client address of the request', () => {
    const serialized = serializeRequest(
      createRequest({
        id: 'trace-1',
        method: 'POST',
        url: '/api/v1/convert',
        ip: '203.0.113.7',
      }),
    );

    expect(serialized).toStrictEqual({
      id: 'trace-1',
      method: 'POST',
      url: '/api/v1/convert',
      remoteAddress: '203.0.113.7',
    });
  });

  it('never writes a header, so no credential can reach the log', () => {
    const serialized = serializeRequest(
      createRequest({
        method: 'DELETE',
        url: '/api/v1/rates/cache',
        headers: {
          authorization: 'Bearer super-secret',
          'x-api-key': 'admin-key',
          cookie: 'session=abc',
        },
      }),
    );

    expect(JSON.stringify(serialized)).not.toMatch(
      /super-secret|admin-key|session=abc/,
    );
    expect(serialized).not.toHaveProperty('headers');
  });

  it('reports the path the client asked for, not the one the router rewrote', () => {
    const serialized = serializeRequest(
      createRequest({ url: '/convert', originalUrl: '/api/v1/convert' }),
    );

    expect(serialized.url).toBe('/api/v1/convert');
  });

  it('falls back to the socket address when express has no client ip', () => {
    const serialized = serializeRequest(
      createRequest({ url: '/health', remoteAddress: '10.0.0.4' }),
    );

    expect(serialized.remoteAddress).toBe('10.0.0.4');
  });

  it('reports no id when the request never reached the id middleware', () => {
    expect(
      serializeRequest(createRequest({ url: '/health' })).id,
    ).toBeUndefined();
  });
});

function createResponse(
  statusCode: number,
  headers: Record<string, string> = {},
): ServerResponse {
  return {
    statusCode,
    getHeaders: () => headers,
  } as unknown as ServerResponse;
}

describe('serializeResponse', () => {
  it('reports the status code', () => {
    expect(serializeResponse(createResponse(429))).toStrictEqual({
      statusCode: 429,
    });
  });

  it('never writes a response header, the echoed CSP included', () => {
    const serialized = serializeResponse(
      createResponse(200, {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
        'set-cookie': 'session=abc',
      }),
    );

    expect(JSON.stringify(serialized)).not.toMatch(/script-src|session=abc/);
    expect(serialized).not.toHaveProperty('headers');
  });
});

describe('errorStack', () => {
  it('reports the stack of an error, which is what carries the frames', () => {
    const failure = new Error('EADDRINUSE');

    expect(errorStack(failure)).toBe(failure.stack);
  });

  // A rejection is not always an Error, and the message is better than the
  // "[object Object]" a bare cast would log.
  it('falls back to the message when the error carries no stack', () => {
    const failure = new Error('no frames');
    failure.stack = undefined;

    expect(errorStack(failure)).toBe('no frames');
  });

  it('describes something that was thrown and is not an error at all', () => {
    expect(errorStack('just a string')).toBe('just a string');
  });
});
