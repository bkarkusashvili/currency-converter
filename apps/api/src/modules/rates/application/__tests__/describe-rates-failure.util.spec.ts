import { AxiosError } from 'axios';
import { CircuitOpenError } from '../../../../common/resilience/circuit-open.error';
import { describeRatesFailure } from '../describe-rates-failure.util';

describe('describeRatesFailure', () => {
  it('names the breaker when the call was never attempted', () => {
    expect(describeRatesFailure(new CircuitOpenError())).toBe(
      'upstream circuit open',
    );
  });

  it('says nothing about the upstream for anything else', () => {
    const leaky = new AxiosError(
      'connect ECONNREFUSED https://api.monobank.ua/bank/currency',
    );

    expect(describeRatesFailure(leaky)).toBe('upstream request failed');
    expect(describeRatesFailure(leaky)).not.toContain('monobank');
  });
});
