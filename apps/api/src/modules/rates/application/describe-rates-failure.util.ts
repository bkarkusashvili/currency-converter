import { CircuitOpenError } from '../../../common/resilience/circuit-open.error';

// The reason travels to the client in the error envelope, so it names the
// resilience decision and nothing else. An upstream message is not safe to
// forward: an axios error carries the url, the status text and sometimes the
// body, and a driver error carries the connection string.
export function describeRatesFailure(error: unknown): string {
  return error instanceof CircuitOpenError
    ? 'upstream circuit open'
    : 'upstream request failed';
}
