import { Module, Provider } from '@nestjs/common';
import { LoggingModule } from '../../common/logging/logging.module';
import { HistoryModule } from '../history/history.module';
import { RatesModule } from '../rates/rates.module';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { ConversionStrategy } from './strategies/conversion-strategy';
import { ConversionStrategyResolver } from './strategies/conversion-strategy.resolver';
import { CONVERSION_STRATEGIES } from './strategies/conversion-strategies.token';
import { CrossRateStrategy } from './strategies/cross-rate.strategy';
import { DirectPairStrategy } from './strategies/direct-pair.strategy';
import { IdentityStrategy } from './strategies/identity.strategy';

// The chain, in the order §5 gives it: a currency to itself, then a published
// pair, then two legs through the base currency. The order is the preference —
// one spread beats two — and the resolver takes the first strategy that prices
// the pair, so an `inject` list out of step with the parameters below would
// price EUR → USD through the hryvnia and pay a second spread on every
// conversion that has a published pair. Exported so a testing module can
// resolve the token and assert the order Nest actually builds.
export const conversionStrategiesProvider: Provider = {
  provide: CONVERSION_STRATEGIES,
  inject: [IdentityStrategy, DirectPairStrategy, CrossRateStrategy],
  useFactory: (
    identity: IdentityStrategy,
    direct: DirectPairStrategy,
    cross: CrossRateStrategy,
  ): ConversionStrategy[] => [identity, direct, cross],
};

@Module({
  // Conversion reads the rates through RatesService, so it shares the cache and
  // the single flight rather than spending the upstream's one-a-minute budget
  // on its own fetch.
  imports: [RatesModule, HistoryModule, LoggingModule],
  controllers: [ConversionController],
  providers: [
    IdentityStrategy,
    DirectPairStrategy,
    CrossRateStrategy,
    conversionStrategiesProvider,
    ConversionStrategyResolver,
    ConversionService,
  ],
  exports: [ConversionService],
})
export class ConversionModule {}
