export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/** Normalises any non-2xx body into the envelope from docs/architecture.md §3. */
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
