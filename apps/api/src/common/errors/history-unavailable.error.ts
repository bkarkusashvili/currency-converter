import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-code.enum';

// The history is a dependency of one route rather than of the API (§2): the
// conversions keep being served while Mongo is down, and only /history says so.
// A driver failure would otherwise surface as a 500 carrying a message that
// names the host and, with a password in the url, the credentials.
export class HistoryUnavailableError extends AppError {
  readonly code = ErrorCode.HISTORY_UNAVAILABLE;
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;

  constructor(details?: Record<string, unknown>) {
    super('Conversion history is temporarily unavailable', details);
  }
}
