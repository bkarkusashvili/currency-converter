import { getApiUrl } from '../config';
import { ApiError, parseErrorEnvelope } from './errors';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

const JSON_HEADERS = { Accept: 'application/json' };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const url = `${getApiUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers:
        body === undefined ? JSON_HEADERS : { ...JSON_HEADERS, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw ApiError.network(url, cause);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new ApiError(parseErrorEnvelope(payload, response.status));
  }

  // The API contract in docs/architecture.md §3 is the schema; successful payloads are not re-validated here.
  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
