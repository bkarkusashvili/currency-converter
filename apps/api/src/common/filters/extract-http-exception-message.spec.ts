import { extractHttpExceptionMessage } from './extract-http-exception-message';

const FALLBACK = 'fallback message';

describe('extractHttpExceptionMessage', () => {
  it('returns a plain string payload', () => {
    expect(extractHttpExceptionMessage('Not Found', FALLBACK)).toBe(
      'Not Found',
    );
  });

  it('reads the message of a structured payload', () => {
    expect(
      extractHttpExceptionMessage(
        { statusCode: 404, message: 'Cannot GET /x', error: 'Not Found' },
        FALLBACK,
      ),
    ).toBe('Cannot GET /x');
  });

  it('joins the array message Nest produces for multiple failures', () => {
    expect(
      extractHttpExceptionMessage({ message: ['first', 'second'] }, FALLBACK),
    ).toBe('first; second');
  });

  it('ignores non-string entries in an array message', () => {
    expect(
      extractHttpExceptionMessage({ message: ['first', 2, null] }, FALLBACK),
    ).toBe('first');
  });

  it.each([
    ['no message key', { statusCode: 500 }],
    ['an empty message', { message: '' }],
    ['an empty array message', { message: [] }],
    ['an array with no strings', { message: [1, 2] }],
    ['a non-string message', { message: 42 }],
  ])('falls back when the payload has %s', (_case, payload) => {
    expect(extractHttpExceptionMessage(payload, FALLBACK)).toBe(FALLBACK);
  });
});
