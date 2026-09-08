import { RATE_DECIMALS } from '../../../../common/money/money-decimals';
import { roundHalfUp } from '../../../../common/money/round-half-up';
import { ExchangeRate } from '../../../rates/domain/exchange-rate';
import { CrossRateStrategy } from '../cross-rate.strategy';
import { RATES } from './rates.fixture';

describe('CrossRateStrategy', () => {
  const strategy = new CrossRateStrategy();

  const rateOf = (from: string, to: string): number =>
    roundHalfUp(strategy.price(from, to, RATES)!, RATE_DECIMALS);

  it('is named after the pricing it does', () => {
    expect(strategy.name).toBe('cross');
  });

  describe('the pairs it takes', () => {
    it('takes two currencies that only share the base currency', () => {
      expect(strategy.price('GBP', 'PLN', RATES)).toBeDefined();
      expect(strategy.price('PLN', 'GBP', RATES)).toBeDefined();
    });

    // It can price these, and the direct strategy prices them better; which one
    // answers is the resolver's ordering, not a claim made here.
    it('takes a pair the snapshot also publishes directly', () => {
      expect(strategy.price('EUR', 'USD', RATES)).toBeDefined();
    });

    it('leaves a currency converted to itself to the identity rate', () => {
      expect(strategy.price('GBP', 'GBP', RATES)).toBeUndefined();
    });

    it('does not take a currency with no pair against the base currency', () => {
      const detached: readonly ExchangeRate[] = [
        ...RATES,
        {
          base: 'CHF',
          quote: 'USD',
          cross: 1.2543,
          date: '2026-09-08T11:00:00.000Z',
        },
      ];

      expect(strategy.price('CHF', 'PLN', detached)).toBeUndefined();
    });

    it('does not take a currency the snapshot never mentions', () => {
      expect(strategy.price('XYZ', 'PLN', RATES)).toBeUndefined();
    });
  });

  describe('the rate it prices with', () => {
    it('composes the leg into the base currency with the leg out of it', () => {
      expect(rateOf('GBP', 'PLN')).toBe(4.986802);
    });

    it('prices the return trip from the other sides of the same rates', () => {
      expect(rateOf('PLN', 'GBP')).toBe(0.200529);
    });

    // 60.7562 / 12.1834 both ways would be reciprocal; these two are not,
    // because each leg is paid at the side of the spread the client is on.
    it('is not the reciprocal of itself across a spread', () => {
      expect(rateOf('EUR', 'USD')).toBe(1.15322);
      expect(rateOf('USD', 'EUR')).toBe(0.845566);
    });
  });
});
