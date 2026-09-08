import Big from 'big.js';
import { Money } from '../money';

// `Big.DP` and `Big.RM` are process-wide and writable by anything that imports
// big.js. These are the guarantees the money path is entitled to assume when
// something else has written to them.
describe('Money', () => {
  const GLOBAL_DP = Big.DP;
  const GLOBAL_RM = Big.RM;

  afterEach(() => {
    Big.DP = GLOBAL_DP;
    Big.RM = GLOBAL_RM;
  });

  it('is a constructor of its own rather than the global one', () => {
    expect(Money).not.toBe(Big);
  });

  it('divides to far more places than a rate is published to', () => {
    expect(new Money(1).div(3).toString()).toBe(`0.${'3'.repeat(30)}`);
  });

  it('divides at its own precision when the global one is changed', () => {
    Big.DP = 2;

    expect(new Money(1).div(44.831).toString()).toBe(
      '0.022305993620485824541054181259',
    );
    // The assignment above really did take effect, so the case above is not
    // passing for the reason it would pass on the global constructor.
    expect(new Big(1).div(44.831).toString()).toBe('0.02');
  });

  it('rounds at its own mode when the global one is changed', () => {
    Big.RM = Big.roundDown;

    expect(new Money('0.125').round(2).toString()).toBe('0.13');
  });

  it('carries its configuration through an operation', () => {
    Big.DP = 2;

    expect(new Money(1).times(1).div(3).toString()).toBe(`0.${'3'.repeat(30)}`);
  });
});
