import { CrossRateStrategy } from '../cross-rate.strategy';
import { DirectPairStrategy } from '../direct-pair.strategy';
import { IdentityStrategy } from '../identity.strategy';
import { orderStrategies } from '../order-strategies';

// The order is the preference §5 states — a currency to itself, then a
// published pair, then two legs through the base currency — and this list is
// the only place it is stated. The resolver takes the first strategy that
// prices the pair, so getting this wrong prices EUR → USD through the hryvnia
// and pays a second spread on every conversion that has a published pair.
describe('orderStrategies', () => {
  it('tries the published pair before the path through the base currency', () => {
    const ordered = orderStrategies(
      new IdentityStrategy(),
      new DirectPairStrategy(),
      new CrossRateStrategy(),
    );

    expect(ordered.map((strategy) => strategy.name)).toStrictEqual([
      'identity',
      'direct',
      'cross',
    ]);
  });
});
