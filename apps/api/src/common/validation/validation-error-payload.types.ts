import { FieldValidationError } from './field-validation-error.types';

export interface ValidationErrorPayload {
  errors: FieldValidationError[];
}

function isFieldValidationError(value: unknown): value is FieldValidationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    typeof value.field === 'string' &&
    'messages' in value &&
    Array.isArray(value.messages) &&
    value.messages.every((message: unknown) => typeof message === 'string')
  );
}

export function isValidationErrorPayload(
  payload: unknown,
): payload is ValidationErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'errors' in payload &&
    Array.isArray(payload.errors) &&
    payload.errors.every(isFieldValidationError)
  );
}
