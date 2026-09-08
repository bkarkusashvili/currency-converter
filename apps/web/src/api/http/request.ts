import { ApiError } from './ApiError';
import { apiUrl } from './apiUrl';
import { parseErrorEnvelope } from './errorEnvelope';
import { readJson } from './readJson';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

const JSON_HEADERS = { Accept: 'application/json' };

/** Every non-2xx answer carries the error envelope, so it becomes an ApiError. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const url = apiUrl(path);

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
    throw new ApiError(parseErrorEnvelope(payload.ok ? payload.body : undefined, response.status));
  }

  // The API contract in docs/architecture.md §3 is the schema; successful payloads are not re-validated here.
  return (payload.ok ? payload.body : undefined) as T;
}
