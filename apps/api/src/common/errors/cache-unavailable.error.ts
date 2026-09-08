import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-code.enum';

// The cache refusing a command is a degradation on the request path and a
// failure on the admin one. `DELETE /rates/cache` is not a read on the way to
// an answer: it is a state change the caller asked for, and the only reason to
// ask for it is to force the next read to refetch. Answering 204 for keys that
// are still there tells an operator the cache is empty when it is not, and the
// stale rates they were clearing keep being served.
export class CacheUnavailableError extends AppError {
  readonly code = ErrorCode.CACHE_UNAVAILABLE;
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;

  constructor(details?: Record<string, unknown>) {
    super('The rates cache is temporarily unavailable', details);
  }
}
