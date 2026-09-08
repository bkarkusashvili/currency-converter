import { findRate } from '../find-rate';
import { RATES } from './rates.fixture';

describe('findRate', () => {
  it('finds the pair the upstream published', () => {
    expect(findRate(RATES, 'USD', 'UAH')).toMatchObject({
      buy: 44.35,
      sell: 44.831,
    });
  });

  it('does not find the same pair the other way round', () => {
    expect(findRate(RATES, 'UAH', 'USD')).toBeUndefined();
  });

  it('finds a pair that does not involve the base currency', () => {
    expect(findRate(RATES, 'EUR', 'USD')).toMatchObject({ buy: 1.1655 });
  });

  it('answers undefined for a pair the snapshot does not hold', () => {
    expect(findRate(RATES, 'GBP', 'PLN')).toBeUndefined();
  });

  it('answers undefined against an empty snapshot', () => {
    expect(findRate([], 'USD', 'UAH')).toBeUndefined();
  });
});
