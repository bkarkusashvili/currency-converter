import { describe, expect, it } from 'vitest';
import { ApiError, extractFieldErrors } from './errors';

function validationError(details: Record<string, unknown>): ApiError {
  return new ApiError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details,
  });
}

describe('extractFieldErrors', () => {
  it('reads the per-field messages from details.errors', () => {
    const error = validationError({
      errors: [
        { field: 'amount', messages: ['amount must be a positive number'] },
        { field: 'to', messages: ['to must be an ISO 4217 code'] },
      ],
    });

    expect(extractFieldErrors(error)).toEqual([
      { field: 'amount', messages: ['amount must be a positive number'] },
      { field: 'to', messages: ['to must be an ISO 4217 code'] },
    ]);
  });

  it('accepts plain string entries and a single message', () => {
    const error = validationError({
      errors: ['amount should not be empty', { field: 'from', message: 'from must be a string' }],
    });

    expect(extractFieldErrors(error)).toEqual([
      { messages: ['amount should not be empty'] },
      { field: 'from', messages: ['from must be a string'] },
    ]);
  });

  it('returns nothing for other error codes or malformed details', () => {
    const otherCode = new ApiError({
      statusCode: 503,
      code: 'RATES_UNAVAILABLE',
      message: 'Exchange rates are unavailable',
      details: { errors: [{ field: 'amount', messages: ['ignored'] }] },
    });

    expect(extractFieldErrors(otherCode)).toEqual([]);
    expect(extractFieldErrors(validationError({ errors: 'nope' }))).toEqual([]);
    expect(extractFieldErrors(validationError({ errors: [{ field: 'amount' }] }))).toEqual([]);
  });
});
