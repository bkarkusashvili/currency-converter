import Big from 'big.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { RatesSnapshotResponse } from '../../../api/types';
import { convertOffline } from '../lib/convertOffline';
import { Money } from '../lib/money';

const BIG_DEFAULT_DP = 20;

const snapshot: RatesSnapshotResponse = {
  source: 'cache',
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    {
      base: 'USD',
      quote: 'UAH',
      buy: 44.35,
      sell: 44.831,
      date: '2026-09-08T11:00:00.000Z',
    },
  ],
};

afterEach(() => {
  Big.DP = BIG_DEFAULT_DP;
});

describe('Money', () => {
  it('divides at its own precision whatever the global Big is set to', () => {
    Big.DP = 2;

    expect(new Big(1).div(44.831).toNumber()).toBe(0.02);
    expect(new Money(1).div(44.831).toNumber()).toBeCloseTo(0.0223059936, 10);
  });

  it('keeps the estimate on rate even then', () => {
    Big.DP = 2;

    expect(convertOffline({ from: 'UAH', to: 'USD', amount: 1000 }, snapshot)).toMatchObject({
      rate: 0.022306,
      result: 22.31,
    });
  });
});
