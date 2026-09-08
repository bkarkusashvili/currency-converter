import { Injectable } from '@nestjs/common';
import type Big from 'big.js';
import { Money } from '../../../common/money/money';
import { CurrencyCode } from '../../../common/currency/currency-code';
import { ConversionStrategy } from './conversion-strategy';
import { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name';

// A currency converted to itself is worth itself. It is first in the chain
// rather than an early return in the service because the snapshot does hold a
// path from a currency back to itself — out to the hryvnia and back, losing
// both spreads — and that path is not what the client asked for.
//
// It stays ignorant of the rates on purpose: one is the rate whatever the
// snapshot holds. Whether a pair of codes the snapshot never quotes reaches it
// at all is the resolver's decision, taken before the chain runs.
@Injectable()
export class IdentityStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = 'identity';

  price(from: CurrencyCode, to: CurrencyCode): Big | undefined {
    return from === to ? new Money(1) : undefined;
  }
}
