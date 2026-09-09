import { HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { ErrorCode } from './error-code.enum';

// The rate archive is a dependency of one route rather than of the API (§2):
// every other route keeps answering while Mongo is down, and only
// /rates/history says so. An empty series would read as "the pair was never
// published", which is a different answer from "the store cannot be read", and
// a driver failure would surface as a 500 carrying the host and, with a
// password in the url, the credentials.
export class ArchiveUnavailableError extends AppError {
  readonly code = ErrorCode.ARCHIVE_UNAVAILABLE;
  readonly status = HttpStatus.SERVICE_UNAVAILABLE;

  constructor(details?: Record<string, unknown>) {
    super('The rate history archive is temporarily unavailable', details);
  }
}
