import { Injectable } from '@nestjs/common';
import type Big from 'big.js';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategy } from './conversion-strategy';
import { ConversionStrategyName } from './conversion-strategy-name';
import { directionalRate } from './directional-rate';
import { requireRate } from './require-rate';

// One pair, either way round: USD/UAH prices both USD → UAH and UAH → USD, and
// EUR/USD prices the pair that never touches the hryvnia. It is tried before
// the cross rate because a published pair costs one spread where routing
// through the base currency costs two.
@Injectable()
export class DirectPairStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = 'direct';

  supports(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): boolean {
    return directionalRate(from, to, rates) !== undefined;
  }

  rate(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big {
    return requireRate(directionalRate(from, to, rates), from, to);
  }
}
