import { AxiosError, AxiosHeaders } from 'axios';
import { shouldRetryMonobank } from '../should-retry-monobank';

function withStatus(status: number): AxiosError {
  const error = new AxiosError('Request failed');

  error.response = {
    status,
    statusText: '',
    data: undefined,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };

  return error;
}

function withCode(code: string): AxiosError {
  return new AxiosError('No response', code);
}

describe('shouldRetryMonobank', () => {
  it.each([500, 502, 503, 504])('retries a %i', (status) => {
    expect(shouldRetryMonobank(withStatus(status))).toBe(true);
  });

  // Monobank allows one request a minute: retrying a 429 turns a short block
  // into a long one, and the stale cache is the better answer.
  it('never retries a 429', () => {
    expect(shouldRetryMonobank(withStatus(429))).toBe(false);
  });

  it.each([400, 401, 403, 404])('never retries a %i', (status) => {
    expect(shouldRetryMonobank(withStatus(status))).toBe(false);
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'])(
    'retries %s, where no response arrived',
    (code) => {
      expect(shouldRetryMonobank(withCode(code))).toBe(true);
    },
  );

  it('never retries a payload that failed to parse', () => {
    expect(shouldRetryMonobank(new Error('invalid payload'))).toBe(false);
  });

  it('never retries something that is not an error at all', () => {
    expect(shouldRetryMonobank('down')).toBe(false);
  });
});
