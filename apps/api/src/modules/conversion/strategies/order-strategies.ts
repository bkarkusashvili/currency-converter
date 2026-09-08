import { ConversionStrategy } from './conversion-strategy';
import { CrossRateStrategy } from './cross-rate.strategy';
import { DirectPairStrategy } from './direct-pair.strategy';
import { IdentityStrategy } from './identity.strategy';

// The chain, in the order §5 gives it: a currency to itself, then a published
// pair, then two legs through the base currency. The order is the preference —
// one spread beats two — and this list is the only place it is stated, which is
// why it is a function of its own rather than a lambda inside the module: the
// module is wiring, and this is the rule.
export function orderStrategies(
  identity: IdentityStrategy,
  direct: DirectPairStrategy,
  cross: CrossRateStrategy,
): ConversionStrategy[] {
  return [identity, direct, cross];
}
