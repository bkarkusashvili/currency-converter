import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotAcceptableException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ErrorCode } from '../../errors/error-code.enum';
import { deriveErrorCode } from '../derive-error-code';

function codeFor(exception: HttpException): string {
  return deriveErrorCode(exception.getStatus(), exception.getResponse());
}

describe('deriveErrorCode', () => {
  describe('the documented statuses', () => {
    it.each([
      [HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR],
      [HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED],
      [HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN],
      [HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND],
      [HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS],
    ])('maps %d to %s', (status, code) => {
      expect(deriveErrorCode(status, {})).toBe(code);
    });

    it('maps a forbidden request to FORBIDDEN rather than INTERNAL_ERROR', () => {
      expect(codeFor(new ForbiddenException('Nope'))).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('an unmapped 4xx', () => {
    it.each([
      [new NotAcceptableException(), 'NOT_ACCEPTABLE'],
      [new PayloadTooLargeException(), 'PAYLOAD_TOO_LARGE'],
    ])('takes its code from the exception name', (exception, code) => {
      expect(codeFor(exception)).toBe(code);
    });

    it('prefers the name the exception reports over the status', () => {
      const exception = new HttpException(
        { statusCode: 409, error: 'Conversion Already Recorded' },
        HttpStatus.CONFLICT,
      );

      expect(codeFor(exception)).toBe('CONVERSION_ALREADY_RECORDED');
    });

    it('falls back to the status name when the payload carries none', () => {
      expect(codeFor(new HttpException('nope', HttpStatus.CONFLICT))).toBe(
        'CONFLICT',
      );
    });

    it('falls back to INTERNAL_ERROR for a status with no name at all', () => {
      expect(codeFor(new HttpException('nope', 499))).toBe(
        ErrorCode.INTERNAL_ERROR,
      );
    });
  });

  describe('everything else', () => {
    it.each([
      HttpStatus.INTERNAL_SERVER_ERROR,
      HttpStatus.BAD_GATEWAY,
      HttpStatus.SERVICE_UNAVAILABLE,
    ])('keeps a %d generic so nothing internal leaks', (status) => {
      expect(deriveErrorCode(status, { error: 'Redis pool exhausted' })).toBe(
        ErrorCode.INTERNAL_ERROR,
      );
    });

    it('does not invent a code for a non-error status', () => {
      expect(deriveErrorCode(HttpStatus.MOVED_PERMANENTLY, {})).toBe(
        ErrorCode.INTERNAL_ERROR,
      );
    });
  });
});
