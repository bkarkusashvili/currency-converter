import { Injectable } from '@nestjs/common';
import type Big from 'big.js';
import { CurrencyCode } from '../../../common/currency';
import { ExchangeRate } from '../../rates';
import { ConversionStrategy } from './conversion-strategy.interface';
import { ConversionStrategyName } from '../../../common/conversion';
import { directionalRate } from './directional-rate.util';

// One pair, either way round: USD/UAH prices both USD → UAH and UAH → USD, and
// EUR/USD prices the pair that never touches the hryvnia. It is tried before
// the cross rate because a published pair costs one spread where routing
// through the base currency costs two.
@Injectable()
export class DirectPairStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = ConversionStrategyName.Direct;

  price(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big | undefined {
    return directionalRate(from, to, rates);
  }
}
