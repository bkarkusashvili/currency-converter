import {
  ArgumentsHost,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthExceptionFilter } from './health-exception.filter';

describe('HealthExceptionFilter', () => {
  it('answers with the terminus report verbatim instead of the error envelope', () => {
    const report = {
      status: 'error',
      info: { redis: { status: 'up' } },
      error: { mongodb: { status: 'down' } },
      details: { redis: { status: 'up' }, mongodb: { status: 'down' } },
    };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new HealthExceptionFilter().catch(
      new ServiceUnavailableException(report),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith(report);
  });
});
