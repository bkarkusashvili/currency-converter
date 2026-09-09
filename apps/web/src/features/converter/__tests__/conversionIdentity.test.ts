import { describe, expect, it } from 'vitest';
import type { HistoryItem } from '../../../api';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { conversionIdentity } from '../lib/conversionIdentity';

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

const recorded: HistoryItem = {
  ...outcome,
  id: '6f0000000000000000000001',
  source: 'provider',
  createdAt: '2026-09-08T12:00:05.000Z',
};

describe('conversionIdentity', () => {
  it('matches the row the API recorded for the answer on screen', () => {
    expect(conversionIdentity(recorded)).toBe(conversionIdentity(outcome));
  });

  it('separates two conversions that differ in any of the five fields', () => {
    const key = conversionIdentity(outcome);

    expect(conversionIdentity({ ...outcome, amount: 1000.01 })).not.toBe(key);
    expect(conversionIdentity({ ...outcome, result: 44351 })).not.toBe(key);
    expect(conversionIdentity({ ...outcome, to: 'PLN' })).not.toBe(key);
    expect(conversionIdentity({ ...outcome, from: 'EUR' })).not.toBe(key);
    expect(conversionIdentity({ ...outcome, ratesTimestamp: '2026-09-08T13:00:00.000Z' })).not.toBe(
      key,
    );
  });

  it('ignores the fields the row and the answer need not agree on', () => {
    // `createdAt` is the row's, `id` is the store's, and neither is on the
    // response the card was rendered from.
    const moved: HistoryItem = { ...recorded, id: 'other', createdAt: 'later' };
    expect(conversionIdentity(moved)).toBe(conversionIdentity(outcome));
  });
});
