import { VALIDATION_ERROR_CODE, type ApiError } from './ApiError';

export interface FieldError {
  field?: string;
  messages: string[];
}

/** Reads `details.errors` of a VALIDATION_ERROR envelope; server messages are used as returned. */
export function extractFieldErrors(error: ApiError): FieldError[] {
  if (error.code !== VALIDATION_ERROR_CODE || !Array.isArray(error.details?.errors)) {
    return [];
  }

  return error.details.errors.reduce<FieldError[]>((fieldErrors, entry) => {
    const fieldError = toFieldError(entry);
    return fieldError === null ? fieldErrors : [...fieldErrors, fieldError];
  }, []);
}

function toFieldError(entry: unknown): FieldError | null {
  if (typeof entry === 'string') {
    return { messages: [entry] };
  }
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const messages = toMessages(record.messages ?? record.message);
  if (messages.length === 0) {
    return null;
  }

  return typeof record.field === 'string' ? { field: record.field, messages } : { messages };
}

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
