import { ValidationError } from '@nestjs/common';
import { FieldValidationError } from './field-validation-error';

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
