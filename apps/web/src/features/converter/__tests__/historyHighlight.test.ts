import { describe, expect, it } from 'vitest';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { conversionIdentity } from '../lib/conversionIdentity';
import { historyHighlightKey } from '../lib/historyHighlight';
import { OFFLINE_ESTIMATE } from '../lib/provenance';

const outcome: ConversionOutcome = {
  from: 'USD',
  to: 'UAH',
  amount: 1000,
  result: 44350,
  rate: 44.35,
  strategy: 'direct',
  source: 'provider',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

describe('historyHighlightKey', () => {
  it('has nothing to highlight before anything has been converted', () => {
    expect(historyHighlightKey(undefined)).toBeNull();
  });

  it('is the identity of the answer on screen', () => {
    expect(historyHighlightKey(outcome)).toBe(conversionIdentity(outcome));
  });

  it('has nothing to highlight for an estimate, which the API never recorded', () => {
    // Priced in this browser because the API could not be reached, so no row
    // can match it — and an earlier answer's row must not stay tinted either.
    expect(historyHighlightKey({ ...outcome, source: OFFLINE_ESTIMATE })).toBeNull();
  });
});
