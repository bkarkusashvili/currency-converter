import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotAcceptableException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ErrorCode } from '../../errors/error-code.enum';
import {
  deriveErrorCode,
  extractHttpExceptionMessage,
  upperSnakeCase,
} from '../http-exception-mapping.util';

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

const FALLBACK = 'fallback message';

describe('extractHttpExceptionMessage', () => {
  it('returns a plain string payload', () => {
    expect(extractHttpExceptionMessage('Not Found', FALLBACK)).toBe(
      'Not Found',
    );
  });

  it('reads the message of a structured payload', () => {
    expect(
      extractHttpExceptionMessage(
        { statusCode: 404, message: 'Cannot GET /x', error: 'Not Found' },
        FALLBACK,
      ),
    ).toBe('Cannot GET /x');
  });

  it('joins the array message Nest produces for multiple failures', () => {
    expect(
      extractHttpExceptionMessage({ message: ['first', 'second'] }, FALLBACK),
    ).toBe('first; second');
  });

  it('ignores non-string entries in an array message', () => {
    expect(
      extractHttpExceptionMessage({ message: ['first', 2, null] }, FALLBACK),
    ).toBe('first');
  });

  it.each([
    ['no message key', { statusCode: 500 }],
    ['an empty message', { message: '' }],
    ['an empty array message', { message: [] }],
    ['an array with no strings', { message: [1, 2] }],
    ['a non-string message', { message: 42 }],
  ])('falls back when the payload has %s', (_case, payload) => {
    expect(extractHttpExceptionMessage(payload, FALLBACK)).toBe(FALLBACK);
  });
});

describe('upperSnakeCase', () => {
  it.each([
    ['Not Acceptable', 'NOT_ACCEPTABLE'],
    ['NotAcceptable', 'NOT_ACCEPTABLE'],
    ['Payload Too Large', 'PAYLOAD_TOO_LARGE'],
    ["I'm a Teapot", 'I_M_A_TEAPOT'],
    ['UNSUPPORTED_MEDIA_TYPE', 'UNSUPPORTED_MEDIA_TYPE'],
    ['http2 Required', 'HTTP2_REQUIRED'],
  ])('turns %s into %s', (value, expected) => {
    expect(upperSnakeCase(value)).toBe(expected);
  });

  it('drops the separators a name starts or ends with', () => {
    expect(upperSnakeCase('  spaced out  ')).toBe('SPACED_OUT');
  });

  it('produces nothing from a name with no usable characters', () => {
    expect(upperSnakeCase('   ')).toBe('');
  });

  it('bounds a name so it cannot grow the envelope', () => {
    expect(upperSnakeCase('a'.repeat(200))).toHaveLength(48);
  });

  it('does not leave the separator a cut landed on', () => {
    expect(upperSnakeCase(`${'a'.repeat(47)} tail`)).toBe('A'.repeat(47));
  });
});
