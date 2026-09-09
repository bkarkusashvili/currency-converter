import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code.enum';

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: HttpStatus;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
