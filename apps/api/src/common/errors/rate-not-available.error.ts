import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-code.enum';

export class RateNotAvailableError extends AppError {
  readonly code = ErrorCode.RATE_NOT_AVAILABLE;
  readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(from: string, to: string) {
    super(`No exchange rate is available from ${from} to ${to}`, { from, to });
  }
}
