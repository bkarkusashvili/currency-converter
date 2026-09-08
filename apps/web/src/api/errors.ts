export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface FieldError {
  field?: string;
  messages: string[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly requestId: string | undefined;

  constructor(envelope: ErrorEnvelope, options?: ErrorOptions) {
    super(envelope.message, options);
    this.name = 'ApiError';
    this.statusCode = envelope.statusCode;
    this.code = envelope.code;
    this.details = envelope.details;
    this.requestId = envelope.requestId;
  }

  static network(url: string, cause: unknown): ApiError {
    return new ApiError(
      {
        statusCode: 0,
        code: NETWORK_ERROR_CODE,
        message: `Cannot reach the API at ${url}. Check that it is running and reachable.`,
      },
      { cause },
    );
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function parseErrorEnvelope(payload: unknown, statusCode: number): ErrorEnvelope {
  if (
    isRecord(payload) &&
    typeof payload.code === 'string' &&
    typeof payload.message === 'string'
  ) {
    return {
      statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : statusCode,
      code: payload.code,
      message: payload.message,
      details: isRecord(payload.details) ? payload.details : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    };
  }

  return {
    statusCode,
    code: 'INTERNAL_ERROR',
    message: `The API responded with status ${String(statusCode)}.`,
  };
}

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
  if (!isRecord(entry)) {
    return null;
  }

  const messages = toMessages(entry.messages ?? entry.message);
  if (messages.length === 0) {
    return null;
  }

  return typeof entry.field === 'string' ? { field: entry.field, messages } : { messages };
}

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
