import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import { splitServerFieldErrors } from '../lib/serverFieldErrors';

describe('splitServerFieldErrors', () => {
  it('is empty without an error', () => {
    expect(splitServerFieldErrors(null)).toEqual({ fields: {}, rest: [] });
  });

  it('routes the fields the form owns and leaves the rest for the notice', () => {
    const error = new ApiError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {
        errors: [
          { field: 'amount', messages: ['amount must be a positive number'] },
          { field: 'to', messages: ['to must be an ISO 4217 code'] },
          { field: 'wat', messages: ['nothing on this form owns that'] },
          { messages: ['no field at all'] },
        ],
      },
    });

    expect(splitServerFieldErrors(error)).toEqual({
      fields: {
        amount: ['amount must be a positive number'],
        to: ['to must be an ISO 4217 code'],
      },
      rest: [
        { field: 'wat', messages: ['nothing on this form owns that'] },
        { messages: ['no field at all'] },
      ],
    });
  });

  it('collects several messages for the same field', () => {
    const error = new ApiError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {
        errors: [
          { field: 'from', messages: ['from must be a string'] },
          { field: 'from', messages: ['from must be 3 characters'] },
        ],
      },
    });

    expect(splitServerFieldErrors(error).fields.from).toEqual([
      'from must be a string',
      'from must be 3 characters',
    ]);
  });
});
