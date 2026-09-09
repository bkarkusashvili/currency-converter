import { IncomingMessage, ServerResponse } from 'node:http';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  errorStack,
  serializeError,
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

// The real thing rather than a shape that resembles it: what makes an axios
// error expensive to log is what its own constructor hangs off it.
function createAxiosError(): AxiosError {
  const config = {
    url: 'https://api.monobank.ua/bank/currency',
    method: 'get',
    headers: {
      'X-Token': 'upstream-token',
      authorization: 'Bearer super-secret',
    },
  } as unknown as InternalAxiosRequestConfig;

  const response = {
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'set-cookie': 'session=abc' },
    data: { errorDescription: 'upstream is down' },
    config,
  } as unknown as AxiosResponse;

  return new AxiosError(
    'Request failed with status code 502',
    'ERR_BAD_RESPONSE',
    config,
    { path: '/bank/currency' },
    response,
  );
}

describe('serializeError', () => {
  it('projects an axios failure onto the five fields a log line documents', () => {
    expect(serializeError(createAxiosError())).toStrictEqual({
      type: 'AxiosError',
      message: 'Request failed with status code 502',
      code: 'ERR_BAD_RESPONSE',
      status: 502,
      stack: expect.any(String) as string,
    });
  });

  // pino's default serializer walks the whole error, so an upstream call that
  // fails would otherwise write its own request config — url, headers and any
  // credential in them — onto the line.
  it('never writes the request, the config or a header of either', () => {
    const serialized = serializeError(createAxiosError());

    expect(serialized).not.toHaveProperty('config');
    expect(serialized).not.toHaveProperty('request');
    expect(serialized).not.toHaveProperty('response');
    expect(serialized).not.toHaveProperty('headers');
    expect(JSON.stringify(serialized)).not.toMatch(
      /super-secret|upstream-token|session=abc/,
    );
  });

  it('reports the status an axios error carries on the response alone', () => {
    const error = createAxiosError();
    // Axios below 1.x published the status there and nowhere else, and an
    // error assembled by hand in a test double does the same.
    delete (error as { status?: number }).status;

    expect(serializeError(error).status).toBe(502);
  });

  it('reports the transport code of a connection that was refused', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });

    expect(serializeError(refused)).toMatchObject({
      type: 'Error',
      code: 'ECONNREFUSED',
    });
  });

  // An error with nothing beyond its message carries neither key rather than
  // two undefined ones, on the same terms a rate point carries no empty spread.
  it('leaves out the fields a plain error does not carry', () => {
    const serialized = serializeError(new Error('nothing to add'));

    expect(serialized).not.toHaveProperty('code');
    expect(serialized).not.toHaveProperty('status');
    expect(serialized.type).toBe('Error');
  });

  it('names the class of the error rather than restating its message', () => {
    class ArchiveUnreachable extends Error {
      constructor() {
        super('down');
        this.name = ArchiveUnreachable.name;
      }
    }

    expect(serializeError(new ArchiveUnreachable()).type).toBe(
      'ArchiveUnreachable',
    );
  });

  it('describes something that was thrown and is not an error at all', () => {
    expect(serializeError('just a string')).toStrictEqual({
      type: 'string',
      message: 'just a string',
    });
  });
});
