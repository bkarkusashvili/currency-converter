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

export interface CommandOptions {
  method: 'DELETE';
  /** Sent as given: this is how the admin key reaches `x-api-key` and nowhere else. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * What a command answered, as opposed to what it returned: a `204` has no body,
 * and the two things worth knowing about it are the status it carried and the
 * request id it can be traced by.
 */
export interface CommandOutcome {
  status: number;
  /**
   * Read from the `x-request-id` response header, which this API lists in
   * `Access-Control-Expose-Headers` so a browser on an allowed origin can see
   * it. Still optional: a proxy that drops the header, or an API deployed
   * without that CORS setting, leaves the id absent rather than wrong.
   */
  requestId: string | undefined;
}

const JSON_HEADERS = { Accept: 'application/json' };
const REQUEST_ID_HEADER = 'x-request-id';

interface SendOptions {
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** The one call to `fetch`, and the one place a transport failure becomes an ApiError. */
async function send(url: string, options: SendOptions): Promise<Response> {
  const { method, body, headers = {}, signal } = options;

  try {
    return await fetch(url, {
      method,
      signal,
      headers:
        body === undefined
          ? { ...JSON_HEADERS, ...headers }
          : { ...JSON_HEADERS, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw ApiError.network(url, cause);
  }
}

/**
 * Every answer outside `acceptStatuses` carries the error envelope, so it becomes
 * an ApiError. An accepted answer this client cannot read is an error too, rather
 * than an `undefined` the caller only discovers while rendering.
 */
export async function request<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, signal, acceptStatuses, parse = asContractShape } = options;
  const url = apiUrl(path);
  const response = await send(url, { method, body, signal });

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
 * A state change rather than a read: nothing is fetched back, so an empty body
 * is the expected answer and not an unreadable one. A failure is still the
 * envelope, which is where the request id of a failed command comes from.
 */
export async function requestCommand(
  path: string,
  options: CommandOptions,
): Promise<CommandOutcome> {
  const url = apiUrl(path);
  const response = await send(url, options);

  if (!response.ok) {
    const payload = await readJson(response);
    throw new ApiError(parseErrorEnvelope(payload.ok ? payload.body : undefined, response.status));
  }

  return {
    status: response.status,
    requestId: response.headers.get(REQUEST_ID_HEADER) ?? undefined,
  };
}

/**
 * The API contract in docs/architecture.md §3 is the schema, so a body that parses
 * is taken to be the documented shape. This is the single place the client trusts
 * that contract; a caller that cannot afford to passes its own `parse`.
 */
function asContractShape<T>(body: unknown): T {
  return body as T;
}
