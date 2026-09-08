import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../ApiError';
import { request } from '../request';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('request', () => {
  it('returns the parsed payload of a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ currencies: [] }));

    await expect(request('/api/v1/currencies')).resolves.toEqual({ currencies: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/currencies',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends a JSON body with the matching content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await request('/api/v1/convert', { method: 'POST', body: { amount: 10 } });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/convert',
      expect.objectContaining({
        method: 'POST',
        body: '{"amount":10}',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
    );
  });

  it('turns an error envelope into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          statusCode: 422,
          code: 'UNSUPPORTED_CURRENCY',
          message: "Currency 'XYZ' is not supported",
          details: { currency: 'XYZ' },
          requestId: 'req-7',
        },
        422,
      ),
    );

    const error = await request('/api/v1/convert').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 422,
      code: 'UNSUPPORTED_CURRENCY',
      message: "Currency 'XYZ' is not supported",
      details: { currency: 'XYZ' },
      requestId: 'req-7',
    });
  });

  it('falls back to a synthesised envelope when the error body is not one', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway</html>', { status: 502 }));

    const error = await request('/api/v1/convert').catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      statusCode: 502,
      code: 'INTERNAL_ERROR',
      message: 'The API responded with status 502.',
    });
  });

  it('reports a network failure as NETWORK_ERROR carrying the URL', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await request('/api/v1/currencies').catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      details: { url: 'https://api.test/api/v1/currencies' },
    });
  });

  it('uses the fallback API URL when none is configured', async () => {
    window.__APP_CONFIG__ = undefined;
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    await request('/api/v1/history?limit=10');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/history?limit=10',
      expect.anything(),
    );
  });
});
