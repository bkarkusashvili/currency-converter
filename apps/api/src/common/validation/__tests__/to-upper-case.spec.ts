import { toUpperCase } from '../to-upper-case';

describe('toUpperCase', () => {
  it('normalises a lower-case value', () => {
    expect(toUpperCase({ value: 'usd' })).toBe('USD');
  });

  it('leaves an already normalised value alone', () => {
    expect(toUpperCase({ value: 'USD' })).toBe('USD');
  });

  // The field is still validated after this runs, and a type error is what the
  // caller should be told about; turning the value into something else first
  // would report the wrong problem.
  it.each([[42], [null], [undefined], [{ code: 'usd' }]])(
    'passes %p through for the validators to reject',
    (value) => {
      expect(toUpperCase({ value })).toBe(value);
    },
  );
});
