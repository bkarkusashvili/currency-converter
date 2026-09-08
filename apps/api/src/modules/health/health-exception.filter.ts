import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Response } from 'express';

// Terminus reports a failing indicator by throwing a ServiceUnavailableException
// whose payload is the health report itself. The global envelope would replace
// that with a generic 5xx message and hide which dependency is down, so /health
// keeps its own filter and answers with the report verbatim.
@Catch(ServiceUnavailableException)
export class HealthExceptionFilter implements ExceptionFilter {
  catch(exception: ServiceUnavailableException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
