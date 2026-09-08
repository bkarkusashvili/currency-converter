import { describe, expect, it } from 'vitest';
import type { RatesSnapshotResponse } from '../../../api/types';
import { goldenConversions, goldenSnapshot } from '../../../test/goldenFixtures';
import { convertOffline } from '../lib/convertOffline';

/**
 * The rates the API's e2e suite converts with, read from
 * `fixtures/rates-snapshot.json` — the same file, not a copy of the numbers.
 * Same input, same output is the point of the file under test, and it is now
 * something CI can check rather than something a comment claims.
 */
const snapshot = goldenSnapshot();
const vectors = goldenConversions();
const QUOTED_AT = snapshot.rates[0]?.date ?? '';

describe('convertOffline', () => {
  // Every row of fixtures/golden-conversions.json, asserted here in the browser
  // copy of §5 and over HTTP by apps/api/test/e2e/conversion.e2e-spec.ts. A
  // change to either implementation that moves a number fails on both sides.
  it.each(vectors)(
    'prices $amount $from to $to at $rate ($strategy)',
    ({ from, to, amount, rate, result, strategy }) => {
      expect(convertOffline({ from, to, amount }, snapshot)).toEqual({
        from,
        to,
        amount,
        rate,
        result,
        strategy,
        ratesTimestamp: snapshot.fetchedAt,
      });
    },
  );

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
});
