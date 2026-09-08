import { IdentityStrategy } from '../identity.strategy';

describe('IdentityStrategy', () => {
  const strategy = new IdentityStrategy();

  it('is named after the pricing it does', () => {
    expect(strategy.name).toBe('identity');
  });

  it('supports a currency converted to itself', () => {
    expect(strategy.supports('USD', 'USD', [])).toBe(true);
  });

  it('does not support two different currencies', () => {
    expect(strategy.supports('USD', 'UAH', [])).toBe(false);
  });

  it('prices the pair at one whatever the snapshot holds', () => {
    expect(strategy.rate().toString()).toBe('1');
  });
});
