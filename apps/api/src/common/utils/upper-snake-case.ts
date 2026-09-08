// Long enough for the longest HTTP reason phrase, short enough that a name the
// caller had a hand in cannot grow the envelope.
const MAX_LENGTH = 48;

// Turns a reason phrase or an exception name into the shape of an error code:
// 'Not Acceptable' and 'NotAcceptable' both come out as NOT_ACCEPTABLE.
export function upperSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase()
    .slice(0, MAX_LENGTH)
    .replace(/^_+|_+$/g, '');
}
