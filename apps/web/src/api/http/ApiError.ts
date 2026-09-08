import type { ErrorEnvelope } from './errorEnvelope';

const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

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
        message: `Cannot reach the API at ${url}.`,
        details: { url },
      },
      { cause },
    );
  }

  static unreadableBody(url: string, statusCode: number): ApiError {
    return new ApiError({
      statusCode,
      code: 'INTERNAL_ERROR',
      message: `The API at ${url} returned a body this client could not read.`,
      details: { url },
    });
  }
}
