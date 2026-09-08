import { Injectable } from '@nestjs/common';
import Big from 'big.js';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ConversionStrategy } from './conversion-strategy';
import { ConversionStrategyName } from './conversion-strategy-name';

// A currency converted to itself is worth itself. It is first in the chain
// rather than an early return in the service because the snapshot does hold a
// path from a currency back to itself — out to the hryvnia and back, losing
// both spreads — and that path is not what the client asked for.
@Injectable()
export class IdentityStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = 'identity';

  supports(from: CurrencyCode, to: CurrencyCode): boolean {
    return from === to;
  }

  rate(): Big {
    return new Big(1);
  }
}
