import { ServerResponse } from 'node:http';
import { serializeResponse } from '../serialize-response';

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
