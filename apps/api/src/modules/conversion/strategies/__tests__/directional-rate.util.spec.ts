import Big from 'big.js';
import { RATE_DECIMALS } from '../../../../common/money/money-decimals.constants';
import { roundHalfUp } from '../../../../common/money/round-half-up.util';
import { ExchangeRate } from '../../../rates/domain/exchange-rate.types';
import { directionalRate } from '../directional-rate.util';
import { RATES } from './rates.fixture';

const QUOTED_AT = '2026-09-08T11:00:00.000Z';

function rateOf(
  from: string,
  to: string,
  rates: readonly ExchangeRate[] = RATES,
): number | undefined {
  const rate = directionalRate(from, to, rates);

  return rate === undefined ? undefined : roundHalfUp(rate, RATE_DECIMALS);
}

describe('directionalRate', () => {
  describe('base to quote', () => {
    it('pays what the bank buys the base at', () => {
      expect(rateOf('USD', 'UAH')).toBe(44.35);
    });

    it('falls back to the mid rate when the pair has no spread', () => {
      expect(rateOf('GBP', 'UAH')).toBe(60.7562);
    });
  });

  describe('quote to base', () => {
    it('divides by what the bank sells the base at', () => {
      expect(rateOf('UAH', 'USD')).toBe(0.022306);
    });

    // The reciprocal of the buy rate would be 0.022548. A client selling
    // hryvnia is buying dollars from the bank, so it pays the sell side.
    it('takes the sell side of the spread rather than the buy side', () => {
      expect(rateOf('UAH', 'USD')).not.toBe(0.022548);
    });

    it('divides by the mid rate when the pair has no spread', () => {
      expect(rateOf('UAH', 'GBP')).toBe(0.016459);
    });
  });

  it('prices a pair that does not involve the base currency', () => {
    expect(rateOf('EUR', 'USD')).toBe(1.1655);
    expect(rateOf('USD', 'EUR')).toBe(0.851861);
  });

  it('answers undefined for two currencies with no pair between them', () => {
    expect(rateOf('GBP', 'PLN')).toBeUndefined();
  });

  it('answers undefined for a currency the snapshot never mentions', () => {
    expect(rateOf('XYZ', 'UAH')).toBeUndefined();
  });

  describe('when the published pair prices only one direction', () => {
    const buyOnly: readonly ExchangeRate[] = [
      { base: 'USD', quote: 'UAH', buy: 44.35, date: QUOTED_AT },
    ];

    it('prices the direction it has', () => {
      expect(rateOf('USD', 'UAH', buyOnly)).toBe(44.35);
    });

    it('does not invent the other one from the rate it has', () => {
      expect(rateOf('UAH', 'USD', buyOnly)).toBeUndefined();
    });
  });

  describe('when both orientations are published', () => {
    const both: readonly ExchangeRate[] = [
      { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: QUOTED_AT },
      { base: 'UAH', quote: 'USD', buy: 0.02, sell: 0.03, date: QUOTED_AT },
    ];

    // Monobank publishes each pair once, so this is only about being
    // deterministic: the answer must not depend on the order of the array.
    it('takes the pair quoted in the asked-for orientation', () => {
      expect(rateOf('UAH', 'USD', both)).toBe(0.02);
    });
  });

  describe('when a cached snapshot carries an unusable rate', () => {
    const zeroed: readonly ExchangeRate[] = [
      {
        base: 'USD',
        quote: 'UAH',
        buy: 0,
        sell: 0,
        cross: 44.5,
        date: QUOTED_AT,
      },
    ];

    it('reads a zero as no rate rather than dividing by it', () => {
      expect(rateOf('UAH', 'USD', zeroed)).toBe(0.022472);
      expect(rateOf('USD', 'UAH', zeroed)).toBe(44.5);
    });

    it('answers undefined when nothing on the pair is usable', () => {
      expect(
        rateOf('USD', 'UAH', [
          { base: 'USD', quote: 'UAH', buy: -1, date: QUOTED_AT },
        ]),
      ).toBeUndefined();
    });
  });

  // The quote → base rate is the one division on the money path. It is built
  // with `Money`, so `Big.DP` — writable by anything in the process — cannot
  // reach it; on the global constructor the same division would answer 0.02.
  describe('when something else has changed the global big.js precision', () => {
    const GLOBAL_DP = Big.DP;

    afterEach(() => {
      Big.DP = GLOBAL_DP;
    });

    it('prices the reciprocal at its own precision', () => {
      Big.DP = 2;

      expect(rateOf('UAH', 'USD')).toBe(0.022306);
      expect(new Big(1).div(44.831).toString()).toBe('0.02');
    });
  });
});
