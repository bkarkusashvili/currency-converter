import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/http/ApiError';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApiErrorNotice } from '../ApiErrorNotice';

describe('ApiErrorNotice', () => {
  it('translates a known envelope code and shows the code and request id', () => {
    renderWithProviders(
      <ApiErrorNotice
        error={
          new ApiError({
            statusCode: 503,
            code: 'RATES_UNAVAILABLE',
            message: 'Exchange rates are unavailable',
            requestId: 'req-42',
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Exchange rates are unavailable: Monobank/);
    expect(screen.getByRole('alert')).toHaveTextContent('RATES_UNAVAILABLE');
    expect(screen.getByRole('alert')).toHaveTextContent('request req-42');
  });

  it('interpolates the URL a network failure carries', () => {
    renderWithProviders(
      <ApiErrorNotice error={ApiError.network('https://api.test/health', new TypeError('nope'))} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cannot reach the API at https://api.test/health.',
    );
  });

  it('falls back to the server message for a code it does not know', () => {
    renderWithProviders(
      <ApiErrorNotice
        error={
          new ApiError({
            statusCode: 418,
            code: 'TEAPOT',
            message: 'The API is a teapot.',
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The API is a teapot.');
  });

  it('lists the field errors the caller could not place on an input', () => {
    renderWithProviders(
      <ApiErrorNotice
        error={new ApiError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'invalid' })}
        fieldErrors={[{ field: 'wat', messages: ['nothing owns that'] }, { messages: ['orphan'] }]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('wat');
    expect(screen.getByRole('alert')).toHaveTextContent('nothing owns that');
    expect(screen.getByRole('alert')).toHaveTextContent('orphan');
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the following and try again.');
  });

  it('drops the lead-in when every message was routed onto an input', () => {
    renderWithProviders(
      <ApiErrorNotice
        error={
          new ApiError({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
          })
        }
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The request did not pass validation.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Fix the following');
  });
});
