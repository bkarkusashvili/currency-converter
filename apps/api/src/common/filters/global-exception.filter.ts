import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AppError, ErrorCode } from '../errors';
import { getRequestId } from '../logging';
import { isValidationErrorPayload } from '../validation';
import {
  deriveErrorCode,
  extractHttpExceptionMessage,
} from './http-exception-mapping.util';
import { ErrorResponseDto } from './error-response.dto';
const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

// Widened to number so comparing it against HttpException.getStatus(), which is
// a plain number, is not an unsafe enum comparison.
const SERVER_ERROR_FLOOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

type ErrorDescription = Pick<
  ErrorResponseDto,
  'statusCode' | 'code' | 'message' | 'details'
>;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = getRequestId(request);

    if (
      !(exception instanceof AppError) &&
      !(exception instanceof HttpException)
    ) {
      // Only genuinely unexpected failures carry a stack worth keeping; handled
      // errors are already accounted for on the per-request log line.
      this.logger.error({ err: exception, requestId }, 'Unhandled exception');
    }

    const body: ErrorResponseDto = {
      ...this.describe(exception),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
    };

    response.status(body.statusCode).json(body);
  }

  private describe(exception: unknown): ErrorDescription {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  private describeHttpException(exception: HttpException): ErrorDescription {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (isValidationErrorPayload(payload)) {
      return {
        statusCode,
        code: ErrorCode.VALIDATION_ERROR,
        message: extractHttpExceptionMessage(payload, exception.message),
        details: { errors: payload.errors },
      };
    }

    // A 5xx must not leak an internal message to the client; a 4xx says what
    // the caller got wrong.
    const message =
      statusCode >= SERVER_ERROR_FLOOR
        ? INTERNAL_ERROR_MESSAGE
        : extractHttpExceptionMessage(payload, exception.message);

    return {
      statusCode,
      code: deriveErrorCode(statusCode, payload),
      message,
    };
  }
}
