import { Money } from '../../../../common/money/money.constants';
import { RateNotAvailableError } from '../../../../common/errors/rate-not-available.error';
import { UnsupportedCurrencyError } from '../../../../common/errors/unsupported-currency.error';
import { ExchangeRate } from '../../../rates/domain/exchange-rate.types';
import { ConversionStrategy } from '../conversion-strategy.interface';
import { ConversionStrategyResolver } from '../conversion-strategy.resolver';
import { CrossRateStrategy } from '../cross-rate.strategy';
import { DirectPairStrategy } from '../direct-pair.strategy';
import { IdentityStrategy } from '../identity.strategy';
import { RATES } from './rates.fixture';

// Declared as properties rather than by implementing the interface: a jest.Mock
// read off a method signature is what the unbound-method rule exists to catch.
interface StrategyDouble {
  name: string;
  price: jest.Mock;
}

function stub(name: string, rate: number | undefined): StrategyDouble {
  return {
    name,
    price: jest
      .fn()
      .mockReturnValue(rate === undefined ? undefined : new Money(rate)),
  };
}

function resolverOf(
  ...strategies: StrategyDouble[]
): ConversionStrategyResolver {
  return new ConversionStrategyResolver(
    strategies as unknown as ConversionStrategy[],
  );
}

describe('ConversionStrategyResolver', () => {
  describe('with the strategies the module registers', () => {
    const resolver = new ConversionStrategyResolver([
      new IdentityStrategy(),
      new DirectPairStrategy(),
      new CrossRateStrategy(),
    ]);

    it.each([
      ['USD', 'USD', 'identity'],
      ['USD', 'UAH', 'direct'],
      ['UAH', 'USD', 'direct'],
      ['EUR', 'USD', 'direct'],
      ['GBP', 'UAH', 'direct'],
      ['GBP', 'PLN', 'cross'],
      ['PLN', 'GBP', 'cross'],
    ])('prices %s to %s with the %s rate', (from, to, name) => {
      expect(resolver.resolve(from, to, RATES).strategy.name).toBe(name);
    });

    // The rate the strategy priced with, carried back with it: computing it
    // once is the difference between the chain answering a question and the
    // service asking the same one again.
    it('answers with the rate the strategy priced, not only with the strategy', () => {
      const { strategy, rate } = resolver.resolve('USD', 'UAH', RATES);

      expect(strategy.name).toBe('direct');
      expect(rate.toString()).toBe('44.35');
    });

    it('reports a code the snapshot never mentions as unsupported', () => {
      expect(() => resolver.resolve('XYZ', 'UAH', RATES)).toThrow(
        UnsupportedCurrencyError,
      );
    });

    it('names the code in the details the envelope carries', () => {
      expect(() => resolver.resolve('UAH', 'XYZ', RATES)).toThrow(
        expect.objectContaining({
          details: { currency: 'XYZ' },
        }) as Error,
      );
    });

    it('names the currency the caller would fix first when neither is known', () => {
      expect(() => resolver.resolve('XYZ', 'ABC', RATES)).toThrow(
        expect.objectContaining({ details: { currency: 'XYZ' } }) as Error,
      );
    });

    // Both codes are quoted, so neither is unsupported; there is simply no path
    // between them, which is a different report with a different code.
    it('reports two quoted currencies with no path between them', () => {
      const detached: readonly ExchangeRate[] = [
        ...RATES,
        {
          base: 'CHF',
          quote: 'USD',
          cross: 1.2543,
          date: '2026-09-08T11:00:00.000Z',
        },
      ];

      expect(() => resolver.resolve('CHF', 'PLN', detached)).toThrow(
        RateNotAvailableError,
      );
    });

    it('reports an empty snapshot against the currency that was asked for', () => {
      expect(() => resolver.resolve('USD', 'UAH', [])).toThrow(
        UnsupportedCurrencyError,
      );
    });

    // Identity prices any code against itself, so a chain asked first would
    // answer this pair 200 with rate 1 for a code /currencies does not list.
    // Membership is settled before the chain, so it is the 422 §3 gives it.
    it('reports a code the snapshot never quotes converted to itself', () => {
      expect(() => resolver.resolve('XYZ', 'XYZ', RATES)).toThrow(
        expect.objectContaining({ details: { currency: 'XYZ' } }) as Error,
      );
    });
  });

  describe('ordering', () => {
    it('takes the first strategy that prices the pair', () => {
      const first = stub('first', 2);
      const second = stub('second', 3);

      expect(
        resolverOf(first, second).resolve('USD', 'UAH', RATES).strategy.name,
      ).toBe('first');
      expect(second.price).not.toHaveBeenCalled();
    });

    it('falls through the ones that decline', () => {
      const first = stub('first', undefined);
      const second = stub('second', 3);

      expect(
        resolverOf(first, second).resolve('USD', 'UAH', RATES).strategy.name,
      ).toBe('second');
    });

    it('asks each strategy about the pair and the rates it was given', () => {
      const only = stub('only', 2);

      resolverOf(only).resolve('USD', 'UAH', RATES);

      expect(only.price).toHaveBeenCalledWith('USD', 'UAH', RATES);
    });

    // The whole point of the collapse: the answer a strategy produced is the
    // one that is used, so nothing prices the pair a second time.
    it('prices the pair once', () => {
      const only = stub('only', 2);

      resolverOf(only).resolve('USD', 'UAH', RATES);

      expect(only.price).toHaveBeenCalledTimes(1);
    });

    it('fails when no registered strategy prices the pair', () => {
      expect(() =>
        resolverOf(stub('none', undefined)).resolve('USD', 'UAH', RATES),
      ).toThrow(RateNotAvailableError);
    });

    // The membership check is a precondition of the chain, not a fallback for
    // it: no strategy is consulted about a code the snapshot never quotes,
    // however eagerly it would have answered.
    it('does not consult the chain about a code the snapshot never quotes', () => {
      const eager = stub('eager', 1);

      expect(() => resolverOf(eager).resolve('XYZ', 'XYZ', RATES)).toThrow(
        UnsupportedCurrencyError,
      );
      expect(eager.price).not.toHaveBeenCalled();
    });
  });
});
