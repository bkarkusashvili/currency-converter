import { Module } from '@nestjs/common';
import { LoggingModule } from '../../common/logging/logging.module';
import { RatesModule } from '../rates/rates.module';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { ConversionStrategyResolver } from './strategies/conversion-strategy.resolver';
import { CONVERSION_STRATEGIES } from './strategies/conversion-strategies.token';
import { CrossRateStrategy } from './strategies/cross-rate.strategy';
import { DirectPairStrategy } from './strategies/direct-pair.strategy';
import { IdentityStrategy } from './strategies/identity.strategy';
import type { ConversionStrategy } from './strategies/conversion-strategy';

// The chain, in the order §5 gives it: a currency to itself, then a published
// pair, then two legs through the base currency. The order is the preference —
// one spread beats two — and this list is the only place it is stated.
function orderStrategies(
  identity: IdentityStrategy,
  direct: DirectPairStrategy,
  cross: CrossRateStrategy,
): ConversionStrategy[] {
  return [identity, direct, cross];
}

@Module({
  // Conversion reads the rates through RatesService, so it shares the cache and
  // the single flight rather than spending the upstream's one-a-minute budget
  // on its own fetch.
  imports: [RatesModule, LoggingModule],
  controllers: [ConversionController],
  providers: [
    IdentityStrategy,
    DirectPairStrategy,
    CrossRateStrategy,
    {
      provide: CONVERSION_STRATEGIES,
      inject: [IdentityStrategy, DirectPairStrategy, CrossRateStrategy],
      useFactory: orderStrategies,
    },
    ConversionStrategyResolver,
    ConversionService,
  ],
  // The history module records what a conversion produced, and the service
  // returns the whole result for it to record.
  exports: [ConversionService],
})
export class ConversionModule {}
