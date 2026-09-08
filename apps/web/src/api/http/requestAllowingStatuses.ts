import { ApiError } from './ApiError';
import { apiUrl } from './apiUrl';
import { parseErrorEnvelope } from './errorEnvelope';
import { readJson } from './readJson';

/**
 * Transport for endpoints whose body is meaningful on more than one status.
 * `GET /health` answers 503 with the terminus report itself, which names the
 * dependency that is down; treating that as unreachable throws the answer away.
 */
export async function requestAllowingStatuses(
  path: string,
  acceptStatuses: readonly number[],
  signal?: AbortSignal,
): Promise<unknown> {
  const url = apiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
  } catch (cause) {
    throw ApiError.network(url, cause);
  }

  const payload = await readJson(response);

  if (!acceptStatuses.includes(response.status)) {
    throw new ApiError(parseErrorEnvelope(payload.ok ? payload.body : undefined, response.status));
  }
  if (!payload.ok) {
    throw ApiError.unreadableBody(url, response.status);
  }

  return payload.body;
}
