import { HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { ErrorCode } from './error-code.enum';

export class UnsupportedCurrencyError extends AppError {
  readonly code = ErrorCode.UNSUPPORTED_CURRENCY;
  readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(currency: string) {
    super(`Currency '${currency}' is not supported`, { currency });
  }
}
