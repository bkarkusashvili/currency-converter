import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-code.enum';

export class UnauthorizedError extends AppError {
  readonly code = ErrorCode.UNAUTHORIZED;
  readonly status = HttpStatus.UNAUTHORIZED;

  constructor(
    message = 'A valid x-api-key header is required',
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}
