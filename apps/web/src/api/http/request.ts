import { ApiError } from './ApiError';
import { apiUrl } from './apiUrl';
import { parseErrorEnvelope } from './errorEnvelope';
import { readJson } from './readJson';

export interface RequestOptions<T> {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Statuses whose body is the answer rather than a failure. `GET /health`
   * answers `503` with the terminus report itself, which names the dependency
   * that is down; treating that as unreachable throws the answer away. Defaults
   * to every 2xx.
   */
  acceptStatuses?: readonly number[];
  /**
   * Validates the body of an accepted answer. Returning `null` makes it an
   * unreadable body, reported with the status it arrived on.
   */
  parse?: (body: unknown) => T | null;
}

const JSON_HEADERS = { Accept: 'application/json' };

/**
 * Every answer outside `acceptStatuses` carries the error envelope, so it becomes
 * an ApiError. An accepted answer this client cannot read is an error too, rather
 * than an `undefined` the caller only discovers while rendering.
 */
export async function request<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, signal, acceptStatuses, parse = asContractShape } = options;
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
  const accepted =
    acceptStatuses === undefined ? response.ok : acceptStatuses.includes(response.status);

  if (!accepted) {
    throw new ApiError(parseErrorEnvelope(payload.ok ? payload.body : undefined, response.status));
  }
  if (!payload.ok) {
    throw ApiError.unreadableBody(url, response.status);
  }

  const parsed = parse(payload.body);
  if (parsed === null) {
    throw ApiError.unreadableBody(url, response.status);
  }

  return parsed;
}

/**
 * The API contract in docs/architecture.md §3 is the schema, so a body that parses
 * is taken to be the documented shape. This is the single place the client trusts
 * that contract; a caller that cannot afford to passes its own `parse`.
 */
function asContractShape<T>(body: unknown): T {
  return body as T;
}
