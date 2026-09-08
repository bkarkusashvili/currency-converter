import { ErrorCode } from '../errors/error-code.enum';

export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId?: string;
}
