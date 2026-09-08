import { Test } from '@nestjs/testing';
import { conversionStrategiesProvider } from '../conversion.module';
import {
  ConversionStrategy,
  CONVERSION_STRATEGIES,
} from '../strategies/conversion-strategy';
import { CrossRateStrategy } from '../strategies/cross-rate.strategy';
import { DirectPairStrategy } from '../strategies/direct-pair.strategy';
import { IdentityStrategy } from '../strategies/identity.strategy';

// Through Nest rather than by calling a factory with three arguments of its
// own choosing: what can actually go wrong here is the `inject` list drifting
// out of step with the parameters it fills, and a direct call cannot see that.
// The order is §5's preference — a currency to itself, then a published pair,
// then two legs through the base currency — and the resolver takes the first
// strategy that prices the pair, so `cross` before `direct` would pay a second
// spread on every EUR → USD conversion the snapshot publishes a pair for.
describe('the CONVERSION_STRATEGIES the module wires', () => {
  it('resolves the chain in the order §5 gives it', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        IdentityStrategy,
        DirectPairStrategy,
        CrossRateStrategy,
        conversionStrategiesProvider,
      ],
    }).compile();

    const strategies = moduleRef.get<ConversionStrategy[]>(
      CONVERSION_STRATEGIES,
    );

    expect(strategies.map((strategy) => strategy.name)).toStrictEqual([
      'identity',
      'direct',
      'cross',
    ]);
  });
});
