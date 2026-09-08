import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorCode } from './error-code.enum';
import { RateNotAvailableError } from './rate-not-available.error';
import { RatesUnavailableError } from './rates-unavailable.error';
import { UnauthorizedError } from './unauthorized.error';
import { UnsupportedCurrencyError } from './unsupported-currency.error';

describe('AppError', () => {
  it.each([
    new UnsupportedCurrencyError('XYZ'),
    new RateNotAvailableError('EUR', 'GBP'),
    new RatesUnavailableError(),
    new UnauthorizedError(),
  ])('is a real Error subclass carrying a stack (%s)', (error) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toContain(error.constructor.name);
  });

  it.each([
    new UnsupportedCurrencyError('XYZ'),
    new RateNotAvailableError('EUR', 'GBP'),
    new RatesUnavailableError(),
    new UnauthorizedError(),
  ])('reports its own class name rather than "Error"', (error) => {
    expect(error.name).toBe(error.constructor.name);
  });

  it.each([
    new UnsupportedCurrencyError('XYZ'),
    new RateNotAvailableError('EUR', 'GBP'),
    new RatesUnavailableError(),
    new UnauthorizedError(),
  ])('has a non-empty default message (%s)', (error) => {
    expect(error.message.length).toBeGreaterThan(0);
  });
});

describe('UnsupportedCurrencyError', () => {
  const error = new UnsupportedCurrencyError('XYZ');

  it('maps to 422 UNSUPPORTED_CURRENCY', () => {
    expect(error.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe(ErrorCode.UNSUPPORTED_CURRENCY);
  });

  it('names the offending currency in the message and the details', () => {
    expect(error.message).toBe("Currency 'XYZ' is not supported");
    expect(error.details).toStrictEqual({ currency: 'XYZ' });
  });
});

describe('RateNotAvailableError', () => {
  const error = new RateNotAvailableError('EUR', 'GBP');

  it('maps to 422 RATE_NOT_AVAILABLE', () => {
    expect(error.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(error.code).toBe(ErrorCode.RATE_NOT_AVAILABLE);
  });

  it('reports both sides of the pair', () => {
    expect(error.message).toBe('No exchange rate is available from EUR to GBP');
    expect(error.details).toStrictEqual({ from: 'EUR', to: 'GBP' });
  });
});

describe('RatesUnavailableError', () => {
  it('maps to 503 RATES_UNAVAILABLE with no details by default', () => {
    const error = new RatesUnavailableError();

    expect(error.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(error.code).toBe(ErrorCode.RATES_UNAVAILABLE);
    expect(error.message).toBe('Exchange rates are temporarily unavailable');
    expect(error.details).toBeUndefined();
  });

  it('carries the cause when one is supplied', () => {
    expect(
      new RatesUnavailableError({ reason: 'circuit-open' }).details,
    ).toStrictEqual({ reason: 'circuit-open' });
  });
});

describe('UnauthorizedError', () => {
  it('maps to 401 UNAUTHORIZED with a default message', () => {
    const error = new UnauthorizedError();

    expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.message).toBe('A valid x-api-key header is required');
    expect(error.details).toBeUndefined();
  });

  it('accepts an overriding message and details', () => {
    const error = new UnauthorizedError('Key expired', { keyId: 'k1' });

    expect(error.message).toBe('Key expired');
    expect(error.details).toStrictEqual({ keyId: 'k1' });
  });
});
