import { RATE_DECIMALS } from '../../../../common/money/money-decimals';
import { roundHalfUp } from '../../../../common/money/round-half-up';
import { RateNotAvailableError } from '../../../../common/errors/rate-not-available.error';
import { DirectPairStrategy } from '../direct-pair.strategy';
import { RATES } from './rates.fixture';

describe('DirectPairStrategy', () => {
  const strategy = new DirectPairStrategy();

  const rateOf = (from: string, to: string): number =>
    roundHalfUp(strategy.rate(from, to, RATES), RATE_DECIMALS);

  it('is named after the pricing it does', () => {
    expect(strategy.name).toBe('direct');
  });

  describe('supports', () => {
    it.each([
      ['USD', 'UAH'],
      ['UAH', 'USD'],
      ['EUR', 'USD'],
      ['USD', 'EUR'],
      ['GBP', 'UAH'],
      ['UAH', 'PLN'],
    ])('takes %s to %s, which the snapshot quotes', (from, to) => {
      expect(strategy.supports(from, to, RATES)).toBe(true);
    });

    it('leaves two currencies with no pair between them to the cross rate', () => {
      expect(strategy.supports('GBP', 'PLN', RATES)).toBe(false);
    });

    it('does not take a currency the snapshot never mentions', () => {
      expect(strategy.supports('XYZ', 'UAH', RATES)).toBe(false);
    });
  });

  describe('rate', () => {
    it('multiplies by the buy rate going from base to quote', () => {
      expect(rateOf('USD', 'UAH')).toBe(44.35);
    });

    it('divides by the sell rate going from quote to base', () => {
      expect(rateOf('UAH', 'USD')).toBe(0.022306);
    });

    it('uses the mid rate for a pair published without a spread', () => {
      expect(rateOf('GBP', 'UAH')).toBe(60.7562);
      expect(rateOf('UAH', 'GBP')).toBe(0.016459);
    });

    it('prices a pair that never touches the base currency', () => {
      expect(rateOf('EUR', 'USD')).toBe(1.1655);
    });

    // The cross rate would route EUR through the hryvnia at 1.15322 and lose a
    // second spread on the way; the published pair is the better price and the
    // reason this strategy is tried first.
    it('prefers the published pair to the path through the base currency', () => {
      expect(rateOf('EUR', 'USD')).not.toBe(1.15322);
    });

    it('answers the documented 422 when it is asked for a pair it does not support', () => {
      expect(() => strategy.rate('GBP', 'PLN', RATES)).toThrow(
        RateNotAvailableError,
      );
    });
  });
});
