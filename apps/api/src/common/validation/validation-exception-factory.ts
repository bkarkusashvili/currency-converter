import {
  BadRequestException,
  HttpStatus,
  ValidationError,
} from '@nestjs/common';
import { ErrorCode } from '../errors/error-code.enum';
import { flattenValidationErrors } from './flatten-validation-errors';

// Shapes the pipe's failure into the payload GlobalExceptionFilter recognises,
// so validation failures reach the client as details.errors.
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Request validation failed',
    errors: flattenValidationErrors(errors),
  });
}
