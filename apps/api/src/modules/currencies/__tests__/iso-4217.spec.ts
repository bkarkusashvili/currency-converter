import { alphaFromNumeric, currencyName } from '../iso-4217';

describe('alphaFromNumeric', () => {
  it.each([
    [840, 'USD'],
    [978, 'EUR'],
    [980, 'UAH'],
    [826, 'GBP'],
    [985, 'PLN'],
  ])('maps %i to %s', (numeric, alpha) => {
    expect(alphaFromNumeric(numeric)).toBe(alpha);
  });

  it('pads a code the upstream sent without its leading zeros', () => {
    expect(alphaFromNumeric(8)).toBe('ALL');
  });

  // 111 is unassigned, and Monobank does publish codes outside the table.
  it.each([111, 0, -978, 97.8, Number.NaN])(
    'has no alpha code for %p',
    (numeric) => {
      expect(alphaFromNumeric(numeric)).toBeUndefined();
    },
  );
});

describe('currencyName', () => {
  it('names a currency the table knows', () => {
    expect(currencyName('UAH')).toBe('Hryvnia');
  });

  it('has no name for a code outside ISO 4217', () => {
    expect(currencyName('XYZ')).toBeUndefined();
  });
});
