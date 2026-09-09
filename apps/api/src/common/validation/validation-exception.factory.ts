import { BadRequestException, ValidationError } from '@nestjs/common';
import { FieldValidationError } from './field-validation-error.types';

// class-validator nests errors for object properties; the envelope exposes a
// flat list keyed by dotted path so a client can map messages onto form fields.
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldValidationError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const messages = Object.values(error.constraints ?? {});
    const children = error.children ?? [];

    return [
      ...(messages.length > 0 ? [{ field, messages }] : []),
      ...flattenValidationErrors(children, field),
    ];
  });
}

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
