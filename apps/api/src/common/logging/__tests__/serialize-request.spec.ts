import { IncomingMessage } from 'node:http';
import { serializeRequest } from '../serialize-request';

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
