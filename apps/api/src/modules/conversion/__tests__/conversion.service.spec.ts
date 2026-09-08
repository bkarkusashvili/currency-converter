import { RatesUnavailableError } from '../../../common/errors/rates-unavailable.error';
import { UnsupportedCurrencyError } from '../../../common/errors/unsupported-currency.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../common/logging/__tests__/fake-pino-logger';
import { RatesService } from '../../rates/application/rates.service';
import { RatesLookup } from '../../rates/domain/rates-lookup';
import { ConversionService } from '../conversion.service';
import { ConversionStrategyResolver } from '../strategies/conversion-strategy.resolver';
import { CrossRateStrategy } from '../strategies/cross-rate.strategy';
import { DirectPairStrategy } from '../strategies/direct-pair.strategy';
import { IdentityStrategy } from '../strategies/identity.strategy';
import { RATES } from '../strategies/__tests__/rates.fixture';

const FETCHED_AT = '2026-09-08T12:00:00.000Z';

const LOOKUP: RatesLookup = {
  source: 'cache',
  snapshot: { fetchedAt: FETCHED_AT, rates: [...RATES] },
};

// Declared as properties rather than by extending the service: a jest.Mock read
// off a method signature is what the unbound-method rule exists to catch.
interface RatesServiceDouble {
  getSnapshot: jest.Mock;
}

describe('ConversionService', () => {
  let rates: RatesServiceDouble;
  let logger: FakePinoLogger;
  let service: ConversionService;

  // The real resolver and the real strategies: the service's job is what it
  // does with a rate, and stubbing the pricing would leave the numbers below
  // asserting on the stub.
  beforeEach(() => {
    rates = { getSnapshot: jest.fn().mockResolvedValue(LOOKUP) };
    logger = createFakePinoLogger();
    service = new ConversionService(
      rates as unknown as RatesService,
      new ConversionStrategyResolver([
        new IdentityStrategy(),
        new DirectPairStrategy(),
        new CrossRateStrategy(),
      ]),
      logger.asPinoLogger(),
    );
  });

  it('answers with the whole documented result', async () => {
    await expect(
      service.convert({ from: 'USD', to: 'UAH', amount: 100 }),
    ).resolves.toStrictEqual({
      from: 'USD',
      to: 'UAH',
      amount: 100,
      result: 4435,
      rate: 44.35,
      strategy: 'direct',
      source: 'cache',
      ratesTimestamp: FETCHED_AT,
    });
  });

  it('rounds the money half-up to two decimals', async () => {
    await expect(
      service.convert({ from: 'UAH', to: 'USD', amount: 250.5 }),
    ).resolves.toMatchObject({ result: 5.59, rate: 0.022306 });
  });

  // The rate is published to six decimals and the result is not computed from
  // it: half a unit in the sixth decimal is 29 groszy on this amount, and the
  // one a client can reconcile is the one the full-precision rate produces.
  it('computes the result from the unrounded rate', async () => {
    await expect(
      service.convert({ from: 'GBP', to: 'PLN', amount: 1_000_000 }),
    ).resolves.toMatchObject({ result: 4986801.71, rate: 4.986802 });
  });

  it('prices a currency against itself at one', async () => {
    await expect(
      service.convert({ from: 'USD', to: 'USD', amount: 12.34 }),
    ).resolves.toMatchObject({ result: 12.34, rate: 1, strategy: 'identity' });
  });

  it('names the strategy that priced the pair', async () => {
    await expect(
      service.convert({ from: 'GBP', to: 'PLN', amount: 1 }),
    ).resolves.toMatchObject({ strategy: 'cross' });
  });

  it('reports how old the rates it used are and where they came from', async () => {
    rates.getSnapshot.mockResolvedValue({ ...LOOKUP, source: 'stale-cache' });

    await expect(
      service.convert({ from: 'USD', to: 'UAH', amount: 1 }),
    ).resolves.toMatchObject({
      source: 'stale-cache',
      ratesTimestamp: FETCHED_AT,
    });
  });

  // Two reads could straddle a cache expiry and price the two legs of a cross
  // rate from two different snapshots.
  it('prices the whole conversion from one snapshot', async () => {
    await service.convert({ from: 'GBP', to: 'PLN', amount: 1 });

    expect(rates.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('lets an unpriceable pair through to the exception filter', async () => {
    await expect(
      service.convert({ from: 'XYZ', to: 'UAH', amount: 1 }),
    ).rejects.toBeInstanceOf(UnsupportedCurrencyError);
  });

  it('lets a rates outage through to the exception filter', async () => {
    rates.getSnapshot.mockRejectedValue(new RatesUnavailableError());

    await expect(
      service.convert({ from: 'USD', to: 'UAH', amount: 1 }),
    ).rejects.toBeInstanceOf(RatesUnavailableError);
  });

  describe('logging', () => {
    it('records the pair, the strategy and the source once', async () => {
      await service.convert({ from: 'GBP', to: 'PLN', amount: 987.65 });

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        'Converted GBP to PLN at the cross rate from cache rates',
      );
    });

    // What a client converts is about the client, not about the rates, so the
    // line that is on in production does not carry it.
    it('keeps the amount out of the line production runs at', async () => {
      await service.convert({ from: 'GBP', to: 'PLN', amount: 987.65 });

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('987.65'),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('987.65'),
      );
    });
  });
});
