import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotAcceptableException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { PinoLogger } from 'nestjs-pino';
import { ErrorCode } from '../../errors/error-code.enum';
import { RatesUnavailableError } from '../../errors/rates-unavailable.error';
import { UnsupportedCurrencyError } from '../../errors/unsupported-currency.error';
import { ErrorResponse } from '../error-response';
import { GlobalExceptionFilter } from '../global-exception.filter';

const PATH = '/api/v1/convert';
const REQUEST_ID = 'request-id-1';

function createResponseDouble(): {
  status: jest.Mock;
  json: jest.Mock<void, [ErrorResponse]>;
} {
  const json = jest.fn<void, [ErrorResponse]>();
  const status = jest.fn(() => ({ json }));

  return { status, json };
}

// ArgumentsHost carries far more surface than a filter touches; the cast keeps
// the double to the two accessors under test.
function createHost(
  response: object,
  requestId: unknown = REQUEST_ID,
): ArgumentsHost {
  const http = {
    getRequest: () => ({ originalUrl: PATH, id: requestId }),
    getResponse: () => response,
  };

  return { switchToHttp: () => http } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let logger: { setContext: jest.Mock; error: jest.Mock };
  let response: ReturnType<typeof createResponseDouble>;

  function captureEnvelope(
    exception: unknown,
    requestId?: unknown,
  ): ErrorResponse {
    filter.catch(
      exception,
      createHost(response, requestId === undefined ? REQUEST_ID : requestId),
    );

    const [body] = response.json.mock.calls.at(-1)!;

    return body;
  }

  beforeEach(() => {
    logger = { setContext: jest.fn(), error: jest.fn() };
    filter = new GlobalExceptionFilter(logger as unknown as PinoLogger);
    response = createResponseDouble();
  });

  it('names its logging context', () => {
    expect(logger.setContext).toHaveBeenCalledWith('GlobalExceptionFilter');
  });

  describe('common envelope fields', () => {
    it('carries the path, the pino request id and an ISO timestamp', () => {
      const body = captureEnvelope(new UnsupportedCurrencyError('XYZ'));

      expect(body.path).toBe(PATH);
      expect(body.requestId).toBe(REQUEST_ID);
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('omits the request id when the logger middleware did not run', () => {
      expect(captureEnvelope(new Error('boom'), undefined).requestId).toBe(
        REQUEST_ID,
      );
      expect(
        captureEnvelope(new Error('boom'), 12345).requestId,
      ).toBeUndefined();
    });

    it('responds with the envelope status', () => {
      captureEnvelope(new UnsupportedCurrencyError('XYZ'));

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    });
  });

  describe('AppError', () => {
    it('uses the error status, code, message and details', () => {
      const body = captureEnvelope(new UnsupportedCurrencyError('XYZ'));

      expect(body).toMatchObject({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ErrorCode.UNSUPPORTED_CURRENCY,
        message: "Currency 'XYZ' is not supported",
        details: { currency: 'XYZ' },
      });
    });

    it('leaves details out when the error carries none', () => {
      const body = captureEnvelope(new RatesUnavailableError());

      expect(body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body.code).toBe(ErrorCode.RATES_UNAVAILABLE);
      expect(body.details).toBeUndefined();
    });

    it('is not logged as an unhandled failure', () => {
      captureEnvelope(new RatesUnavailableError());

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('HttpException', () => {
    it('maps a validation failure to details.errors', () => {
      const body = captureEnvelope(
        new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          errors: [{ field: 'amount', messages: ['amount must be positive'] }],
        }),
      );

      expect(body).toMatchObject({
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: {
          errors: [{ field: 'amount', messages: ['amount must be positive'] }],
        },
      });
    });

    it('still maps a plain 400 to VALIDATION_ERROR without details', () => {
      const body = captureEnvelope(new BadRequestException('Malformed body'));

      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.message).toBe('Malformed body');
      expect(body.details).toBeUndefined();
    });

    it.each([
      [
        new UnauthorizedException(),
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
      ],
      [new NotFoundException(), HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND],
      [
        new ThrottlerException(),
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.TOO_MANY_REQUESTS,
      ],
    ])('maps %# to its documented code', (exception, status, code) => {
      const body = captureEnvelope(exception);

      expect(body.statusCode).toBe(status);
      expect(body.code).toBe(code);
    });

    it('gives a forbidden request its own code', () => {
      const body = captureEnvelope(new ForbiddenException('Nope'));

      expect(body.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(body.code).toBe(ErrorCode.FORBIDDEN);
      expect(body.message).toBe('Nope');
    });

    it('names an unmapped 4xx after the exception rather than INTERNAL_ERROR', () => {
      const body = captureEnvelope(new NotAcceptableException());

      expect(body.statusCode).toBe(HttpStatus.NOT_ACCEPTABLE);
      expect(body.code).toBe('NOT_ACCEPTABLE');
    });

    it('does not leak the message of a 5xx HttpException', () => {
      const body = captureEnvelope(
        new ServiceUnavailableException('upstream pool exhausted at 10.0.0.4'),
      );

      expect(body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.message).toBe('An unexpected error occurred');
    });

    it('joins the array message Nest produces for multiple failures', () => {
      const body = captureEnvelope(
        new HttpException(
          { statusCode: 400, message: ['from is required', 'to is required'] },
          HttpStatus.BAD_REQUEST,
        ),
      );

      expect(body.message).toBe('from is required; to is required');
    });

    it('is not logged as an unhandled failure', () => {
      captureEnvelope(new NotFoundException());

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('unknown exceptions', () => {
    it('answers 500 with a generic message', () => {
      const body = captureEnvelope(
        new Error('connection string is postgres://u:p@h'),
      );

      expect(body).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      });
      expect(body.details).toBeUndefined();
    });

    it('logs the original error at error level', () => {
      const failure = new Error('boom');

      captureEnvelope(failure);

      expect(logger.error).toHaveBeenCalledWith(
        { err: failure, requestId: REQUEST_ID },
        'Unhandled exception',
      );
    });

    it('handles a thrown non-Error', () => {
      const body = captureEnvelope('just a string');

      expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
