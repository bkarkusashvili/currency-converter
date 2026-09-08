import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../errors/error-code.enum';
import { validationExceptionFactory } from './validation-exception-factory';

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
      statusCode: HttpStatus.BAD_REQUEST,
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Request validation failed',
      errors: [{ field: 'amount', messages: ['amount must be positive'] }],
    });
  });
});
