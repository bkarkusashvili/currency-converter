import { ConversionStrategy } from '../conversion-strategy';
import { IdentityStrategy } from '../identity.strategy';
import { RATES } from './rates.fixture';

describe('IdentityStrategy', () => {
  const strategy = new IdentityStrategy();

  it('is named after the pricing it does', () => {
    expect(strategy.name).toBe('identity');
  });

  it('supports a currency converted to itself', () => {
    expect(strategy.supports('USD', 'USD')).toBe(true);
  });

  it('does not support two different currencies', () => {
    expect(strategy.supports('USD', 'UAH')).toBe(false);
  });

  it('prices the pair at one', () => {
    expect(strategy.rate().toString()).toBe('1');
  });

  // Through the port, with the snapshot the other strategies read: identity is
  // the one answer the rates cannot change, including for a currency the
  // snapshot has no pair for at all. That is the strategy's contract and not
  // the endpoint's answer — `ConversionStrategyResolver` settles membership
  // before the chain runs, so `XYZ → XYZ` never reaches this and is reported
  // `UNSUPPORTED_CURRENCY`.
  it('stays ignorant of the snapshot it is handed', () => {
    const port: ConversionStrategy = strategy;

    expect(port.supports('XYZ', 'XYZ', RATES)).toBe(true);
    expect(port.rate('XYZ', 'XYZ', RATES).toString()).toBe('1');
  });
});
