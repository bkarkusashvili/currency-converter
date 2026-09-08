import { Module } from '@nestjs/common';
import { LoggingModule } from '../../common/logging/logging.module';
import { HistoryModule } from '../history/history.module';
import { RatesModule } from '../rates/rates.module';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { ConversionStrategyResolver } from './strategies/conversion-strategy.resolver';
import { CONVERSION_STRATEGIES } from './strategies/conversion-strategies.token';
import { CrossRateStrategy } from './strategies/cross-rate.strategy';
import { DirectPairStrategy } from './strategies/direct-pair.strategy';
import { IdentityStrategy } from './strategies/identity.strategy';
import { orderStrategies } from './strategies/order-strategies';

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
    {
      provide: CONVERSION_STRATEGIES,
      inject: [IdentityStrategy, DirectPairStrategy, CrossRateStrategy],
      useFactory: orderStrategies,
    },
    ConversionStrategyResolver,
    ConversionService,
  ],
  exports: [ConversionService],
})
export class ConversionModule {}
