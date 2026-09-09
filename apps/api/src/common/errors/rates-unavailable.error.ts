import { HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { ErrorCode } from './error-code.enum';

export class RatesUnavailableError extends AppError {
  readonly code = ErrorCode.RATES_UNAVAILABLE;
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;

  constructor(details?: Record<string, unknown>) {
    super('Exchange rates are temporarily unavailable', details);
  }
}
