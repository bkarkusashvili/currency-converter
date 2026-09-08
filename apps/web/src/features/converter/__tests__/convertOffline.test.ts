import { describe, expect, it } from 'vitest';
import type { RatesSnapshotResponse } from '../../../api/types';
import { convertOffline } from '../lib/convertOffline';

const QUOTED_AT = '2026-09-08T11:00:00.000Z';
const FETCHED_AT = '2026-09-08T12:00:00.000Z';

/**
 * The numbers the API's e2e suite converts with: the major pairs carry a
 * spread, the thinner ones only a mid rate, and EUR/USD is the pair that never
 * touches the hryvnia. Same input, same output — that is the point of the file
 * under test.
 */
const snapshot: RatesSnapshotResponse = {
  source: 'cache',
  fetchedAt: FETCHED_AT,
  rates: [
    { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: QUOTED_AT },
    { base: 'EUR', quote: 'UAH', buy: 51.47, sell: 52.0698, date: QUOTED_AT },
    { base: 'EUR', quote: 'USD', buy: 1.157, sell: 1.167, date: QUOTED_AT },
    { base: 'GBP', quote: 'UAH', cross: 60.7562, date: QUOTED_AT },
    { base: 'PLN', quote: 'UAH', cross: 12.1834, date: QUOTED_AT },
  ],
};

describe('convertOffline', () => {
  it('prices base to quote at what the bank buys the base at', () => {
    expect(convertOffline({ from: 'USD', to: 'UAH', amount: 100 }, snapshot)).toEqual({
      from: 'USD',
      to: 'UAH',
      amount: 100,
      result: 4435,
      rate: 44.35,
      strategy: 'direct',
      ratesTimestamp: FETCHED_AT,
    });
  });

  it('prices quote to base at one over what the bank sells the base at', () => {
    expect(convertOffline({ from: 'UAH', to: 'USD', amount: 1000 }, snapshot)).toMatchObject({
      result: 22.31,
      rate: 0.022306,
      strategy: 'direct',
    });
  });

  it('uses the published pair for two currencies that both trade against the hryvnia', () => {
    expect(convertOffline({ from: 'EUR', to: 'USD', amount: 100 }, snapshot)).toMatchObject({
      result: 115.7,
      rate: 1.157,
      strategy: 'direct',
    });
  });

  it('crosses through the hryvnia when no pair is published', () => {
    expect(convertOffline({ from: 'GBP', to: 'PLN', amount: 250 }, snapshot)).toMatchObject({
      result: 1246.7,
      rate: 4.986802,
      strategy: 'cross',
    });
  });

  it('converts a currency to itself at one', () => {
    expect(convertOffline({ from: 'USD', to: 'USD', amount: 100 }, snapshot)).toMatchObject({
      result: 100,
      rate: 1,
      strategy: 'identity',
    });
  });

  it('normalises the codes it is given', () => {
    expect(convertOffline({ from: 'usd', to: 'uah', amount: 100 }, snapshot)).toMatchObject({
      from: 'USD',
      to: 'UAH',
      result: 4435,
    });
  });

  // The server settles membership before the chain runs, so a code it never
  // quotes is UNSUPPORTED_CURRENCY rather than a rate of one against itself.
  it('has no answer for a code it does not quote, even converted to itself', () => {
    expect(convertOffline({ from: 'XYZ', to: 'XYZ', amount: 10 }, snapshot)).toBeUndefined();
  });

  it('has no answer for a currency the snapshot does not price', () => {
    expect(convertOffline({ from: 'XYZ', to: 'UAH', amount: 10 }, snapshot)).toBeUndefined();
    expect(convertOffline({ from: 'UAH', to: 'XYZ', amount: 10 }, snapshot)).toBeUndefined();
    expect(
      convertOffline({ from: 'USD', to: 'UAH', amount: 10 }, { ...snapshot, rates: [] }),
    ).toBeUndefined();
  });

  it('does not price from a rate of zero, which a stored snapshot can carry', () => {
    const zeroed: RatesSnapshotResponse = {
      ...snapshot,
      rates: [{ base: 'USD', quote: 'UAH', buy: 0, sell: 0, date: QUOTED_AT }],
    };

    expect(convertOffline({ from: 'USD', to: 'UAH', amount: 100 }, zeroed)).toBeUndefined();
    expect(convertOffline({ from: 'UAH', to: 'USD', amount: 100 }, zeroed)).toBeUndefined();
  });

  it('has no answer for an amount that is not a finite number', () => {
    expect(
      convertOffline({ from: 'USD', to: 'UAH', amount: Number.POSITIVE_INFINITY }, snapshot),
    ).toBeUndefined();
    expect(
      convertOffline({ from: 'USD', to: 'UAH', amount: Number.NaN }, snapshot),
    ).toBeUndefined();
  });

  it('rounds the rate and the money separately, as the API does', () => {
    // 1 / 12.1834 carries far more precision than the six decimals a rate is
    // published to, and the money is the amount times all of it: multiplying by
    // the published 0.082079 instead would answer 82,079.00, eleven kopiyky out.
    const converted = convertOffline({ from: 'UAH', to: 'PLN', amount: 1_000_000 }, snapshot);

    expect(converted?.rate).toBe(0.082079);
    expect(converted?.result).toBe(82078.89);
  });
});
