import { describe, expect, it } from 'vitest';
import { breakerState, indicatorReason } from '../lib/breakerState';

describe('breakerState', () => {
  it('reads an open circuit off the reason the indicator sent', () => {
    expect(breakerState({ status: 'down', reason: 'circuit open' })).toBe('OPEN');
  });

  it('reads half-open off its own reason, which the API still reports as up', () => {
    expect(breakerState({ status: 'up', reason: 'circuit half-open' })).toBe('HALF_OPEN');
  });

  it('takes an indicator that is up with nothing to say as a closed circuit', () => {
    expect(breakerState({ status: 'up' })).toBe('CLOSED');
  });

  it('guesses nothing from a reason this client has not seen', () => {
    expect(breakerState({ status: 'down', reason: 'something else' })).toBeNull();
    expect(breakerState({ status: 'down' })).toBeNull();
  });

  it('has no state to report for an indicator that is not there', () => {
    expect(breakerState(undefined)).toBeNull();
  });
});

describe('indicatorReason', () => {
  it('passes on the short sentence the API chose for itself', () => {
    expect(indicatorReason({ status: 'down', reason: 'ping failed' })).toBe('ping failed');
  });

  it('drops a reason that is not a sentence, because the report is a runtime document', () => {
    expect(indicatorReason({ status: 'down', reason: { host: 'redis' } })).toBeUndefined();
    expect(indicatorReason({ status: 'up' })).toBeUndefined();
  });
});
