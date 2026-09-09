import { Module } from '@nestjs/common';
import { RatesModule } from '../rates';
import { CurrenciesController } from './currencies.controller';

@Module({
  // The list is a projection of the snapshot, so it goes through RatesService
  // and shares its cache: asking the upstream for a currency list would spend
  // the same one-request-a-minute budget the rates lookup depends on.
  imports: [RatesModule],
  controllers: [CurrenciesController],
})
export class CurrenciesModule {}
