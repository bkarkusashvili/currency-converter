import { isValidationErrorPayload } from '../validation-error-payload.types';

describe('isValidationErrorPayload', () => {
  it('accepts the payload the validation factory builds', () => {
    expect(
      isValidationErrorPayload({
        errors: [{ field: 'amount', messages: ['amount must be positive'] }],
      }),
    ).toBe(true);
  });

  it('accepts an empty error list', () => {
    expect(isValidationErrorPayload({ errors: [] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'Bad Request'],
    ['a number', 400],
    ['an object without errors', { message: 'Bad Request' }],
    ['errors that are not an array', { errors: 'nope' }],
    ['an entry missing field', { errors: [{ messages: ['x'] }] }],
    ['an entry missing messages', { errors: [{ field: 'amount' }] }],
    ['a non-string field', { errors: [{ field: 1, messages: ['x'] }] }],
    [
      'messages that are not an array',
      { errors: [{ field: 'a', messages: 'x' }] },
    ],
    ['a non-string message', { errors: [{ field: 'a', messages: [1] }] }],
    ['a null entry', { errors: [null] }],
  ])('rejects %s', (_case, payload) => {
    expect(isValidationErrorPayload(payload)).toBe(false);
  });
});
