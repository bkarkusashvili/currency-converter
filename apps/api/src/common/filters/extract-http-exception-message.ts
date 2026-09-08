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
