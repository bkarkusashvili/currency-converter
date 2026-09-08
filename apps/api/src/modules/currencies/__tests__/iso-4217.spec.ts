import { alphaFromNumeric, describeCurrency } from '../iso-4217';

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

describe('describeCurrency', () => {
  it('names a currency the table knows and numbers it', () => {
    expect(describeCurrency('UAH')).toStrictEqual({
      code: 'UAH',
      numericCode: 980,
      name: 'Hryvnia',
    });
  });

  // The table stores the numeric code padded to three digits; the API answers
  // with the number, so ALL has to come back as 8 rather than '008'.
  it('reports the numeric code as a number, not the padded string', () => {
    expect(describeCurrency('ALL')).toMatchObject({ numericCode: 8 });
  });

  it('describes nothing for a code outside ISO 4217', () => {
    expect(describeCurrency('XYZ')).toBeUndefined();
  });
});
