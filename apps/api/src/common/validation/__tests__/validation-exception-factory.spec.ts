import { BadRequestException, HttpStatus } from '@nestjs/common';
import { validationExceptionFactory } from '../validation-exception-factory';

describe('validationExceptionFactory', () => {
  const exception = validationExceptionFactory([
    {
      property: 'amount',
      constraints: { isPositive: 'amount must be positive' },
    },
  ]);

  it('produces a 400 BadRequestException', () => {
    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('produces the payload the exception filter recognises', () => {
    expect(exception.getResponse()).toStrictEqual({
      message: 'Request validation failed',
      errors: [{ field: 'amount', messages: ['amount must be positive'] }],
    });
  });

  it('leaves the status and the code to the filter', () => {
    expect(exception.getResponse()).not.toHaveProperty('statusCode');
    expect(exception.getResponse()).not.toHaveProperty('code');
  });
});
