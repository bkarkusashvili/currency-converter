export interface ErrorResponse {
  statusCode: number;
  // An ErrorCode for every documented failure. An unmapped 4xx takes its code
  // from the exception, so the field is not closed over the enum.
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId?: string;
}
