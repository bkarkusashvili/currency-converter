import { describe, expect, it } from 'vitest';
import { inverseRate } from '../lib/inverseRate';

describe('inverseRate', () => {
  it('rounds the other direction to the six places the API publishes', () => {
    // 1 USD = 44.35 UAH, so 1 UAH = 0.0225479… USD.
    expect(inverseRate(44.35)).toBe(0.022548);
    expect(inverseRate(0.847312)).toBe(1.180203);
    expect(inverseRate(1)).toBe(1);
  });

  it('rounds half away from zero, as §5 does', () => {
    expect(inverseRate(1600000)).toBe(0.000001);
    expect(inverseRate(0.0000005)).toBe(2000000);
  });

  it('has nothing to show for a rate that cannot be inverted', () => {
    expect(inverseRate(0)).toBeNull();
    expect(inverseRate(-1)).toBeNull();
    expect(inverseRate(Number.NaN)).toBeNull();
    expect(inverseRate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
