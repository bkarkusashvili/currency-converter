import Big from 'big.js';
import { RATE_DECIMALS, RESULT_DECIMALS } from '../money-decimals';
import { roundHalfUp } from '../round-half-up';

describe('roundHalfUp', () => {
  it('rounds a half up to the money scale', () => {
    expect(roundHalfUp(new Big('0.125'), RESULT_DECIMALS)).toBe(0.13);
  });

  it('rounds a half up to the rate scale', () => {
    expect(roundHalfUp(new Big('1.0000005'), RATE_DECIMALS)).toBe(1.000001);
  });

  it('rounds a half away from zero on a negative value', () => {
    expect(roundHalfUp(new Big('-0.125'), RESULT_DECIMALS)).toBe(-0.13);
  });

  it('leaves a value that already fits the scale alone', () => {
    expect(roundHalfUp(new Big('44.35'), RESULT_DECIMALS)).toBe(44.35);
  });

  it('rounds down below the half', () => {
    expect(roundHalfUp(new Big('0.124999'), RESULT_DECIMALS)).toBe(0.12);
  });

  it('keeps six decimals of a rate that has more', () => {
    expect(roundHalfUp(new Big(1).div(44.831), RATE_DECIMALS)).toBe(0.022306);
  });

  // The float this reads as is 1.00499999999999989, so anything that multiplies
  // by 100 and rounds answers 1. Going through big.js is what makes the
  // documented half-up rule true of the value the caller wrote.
  it('rounds the half a float would have lost', () => {
    expect(roundHalfUp(new Big(1.005), RESULT_DECIMALS)).toBe(1.01);
    expect(Math.round(1.005 * 100) / 100).toBe(1);
  });

  it('multiplies without the float error the same product has', () => {
    expect(roundHalfUp(new Big('0.1').times('0.2'), RATE_DECIMALS)).toBe(0.02);
    expect(0.1 * 0.2).not.toBe(0.02);
  });

  it('composes an amount and a rate exactly', () => {
    const rate = new Big(1).div('1.1');

    expect(roundHalfUp(new Big('1.1').times(rate), RESULT_DECIMALS)).toBe(1);
  });

  it('rounds only once, at the end of the composition', () => {
    const rate = new Big('1.004999');

    expect(roundHalfUp(new Big(1).times(rate), RESULT_DECIMALS)).toBe(1);
  });
});
