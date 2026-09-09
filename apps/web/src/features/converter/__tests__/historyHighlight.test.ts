import { describe, expect, it } from 'vitest';
import type { HistoryItem } from '../../../api';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { conversionKey, historyHighlightKey } from '../lib/historyHighlight';

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

describe('conversionKey', () => {
  it('matches the row the API recorded for the answer on screen', () => {
    expect(conversionKey(recorded)).toBe(conversionKey(outcome));
  });

  it('separates two conversions that differ in any of the five fields', () => {
    const key = conversionKey(outcome);

    expect(conversionKey({ ...outcome, amount: 1000.01 })).not.toBe(key);
    expect(conversionKey({ ...outcome, result: 44351 })).not.toBe(key);
    expect(conversionKey({ ...outcome, to: 'PLN' })).not.toBe(key);
    expect(conversionKey({ ...outcome, from: 'EUR' })).not.toBe(key);
    expect(conversionKey({ ...outcome, ratesTimestamp: '2026-09-08T13:00:00.000Z' })).not.toBe(key);
  });

  it('ignores the fields the row and the answer need not agree on', () => {
    // `createdAt` is the row's, `id` is the store's, and neither is on the
    // response the card was rendered from.
    const moved: HistoryItem = { ...recorded, id: 'other', createdAt: 'later' };
    expect(conversionKey(moved)).toBe(conversionKey(outcome));
  });
});

describe('historyHighlightKey', () => {
  it('has nothing to highlight before anything has been converted', () => {
    expect(historyHighlightKey(undefined)).toBeNull();
  });

  it('is the key of the answer on screen', () => {
    expect(historyHighlightKey(outcome)).toBe(conversionKey(recorded));
  });
});
