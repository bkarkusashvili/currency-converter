import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../errors/error-code.enum';

// Everything that turns a Nest HttpException into the two envelope fields the
// filter cannot read off it directly: the code a client switches on, and the
// sentence it shows. Kept beside the filter rather than inside it because the
// filter is about the response and these are about the exception.

// Long enough for the longest HTTP reason phrase, short enough that a name the
// caller had a hand in cannot grow the envelope.
const MAX_NAME_LENGTH = 48;

// Turns a reason phrase or an exception name into the shape of an error code:
// 'Not Acceptable' and 'NotAcceptable' both come out as NOT_ACCEPTABLE.
export function upperSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase()
    .slice(0, MAX_NAME_LENGTH)
    .replace(/^_+|_+$/g, '');
}

const CODES_BY_STATUS: ReadonlyMap<number, ErrorCode> = new Map([
  [HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR],
  [HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED],
  [HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN],
  [HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND],
  [HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS],
]);

// Widened to number so comparing them against HttpException.getStatus(), which
// is a plain number, is not an unsafe enum comparison.
const CLIENT_ERROR_FLOOR: number = HttpStatus.BAD_REQUEST;
const SERVER_ERROR_FLOOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

// Nest puts the reason phrase of an HttpException under `error`.
function reportedErrorName(payload: string | object): string {
  return typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
    ? payload.error
    : '';
}

// The status enum's own key is already an upper snake case name, and it covers
// an exception raised with a payload that carries no name to read.
function statusName(status: number): string {
  const name: unknown = HttpStatus[status];

  return typeof name === 'string' ? name : '';
}

// A 5xx never gets a code of its own: the caller is told INTERNAL_ERROR and the
// detail stays in the log. A 4xx keeps its HTTP meaning, so an unmapped one
// takes a code from the exception instead of answering INTERNAL_ERROR beside a
// 4xx status, which reads as a contradiction.
export function deriveErrorCode(
  status: number,
  payload: string | object,
): string {
  const mapped = CODES_BY_STATUS.get(status);

  if (mapped !== undefined) {
    return mapped;
  }

  if (status < CLIENT_ERROR_FLOOR || status >= SERVER_ERROR_FLOOR) {
    return ErrorCode.INTERNAL_ERROR;
  }

  return (
    upperSnakeCase(reportedErrorName(payload)) ||
    upperSnakeCase(statusName(status)) ||
    ErrorCode.INTERNAL_ERROR
  );
}

// A Nest HttpException carries either a plain string or a
// { statusCode, message, error } object, and `message` may itself be an array.
export function extractHttpExceptionMessage(
  payload: string | object,
  fallback: string,
): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if ('message' in payload) {
    const { message } = payload;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    if (Array.isArray(message)) {
      const joined = message
        .filter((entry: unknown): entry is string => typeof entry === 'string')
        .join('; ');

      if (joined.length > 0) {
        return joined;
      }
    }
  }

  return fallback;
}
