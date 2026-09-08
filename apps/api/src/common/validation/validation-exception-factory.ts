import { BadRequestException, ValidationError } from '@nestjs/common';
import { flattenValidationErrors } from './flatten-validation-errors';

// Shapes the pipe's failure into the payload GlobalExceptionFilter recognises,
// so validation failures reach the client as details.errors. The status and the
// code are the filter's to decide: repeating them here gave the envelope two
// sources of truth and the ones written here were never read.
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    message: 'Request validation failed',
    errors: flattenValidationErrors(errors),
  });
}
