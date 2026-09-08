import { describe, expect, it } from 'vitest';
import type { Currency } from '../../../api/types';
import { currencyOptions, optionName } from '../lib/currencyOptions';

const currencies: Currency[] = [
  { code: 'EUR', numericCode: 978, name: 'Euro' },
  { code: 'USD', numericCode: 840, name: 'US Dollar' },
];

describe('currencyOptions', () => {
  it('offers the list it was given', () => {
    expect(currencyOptions(currencies)).toEqual([
      { code: 'EUR', name: 'Euro' },
      { code: 'USD', name: 'US Dollar' },
    ]);
  });

  it('falls back to the two defaults when there is no list at all', () => {
    expect(currencyOptions(undefined)).toEqual([{ code: 'USD' }, { code: 'UAH' }]);
    expect(currencyOptions([])).toEqual([{ code: 'USD' }, { code: 'UAH' }]);
  });
});

describe('optionName', () => {
  it('keeps a name that says something the code does not', () => {
    expect(optionName({ code: 'EUR', name: 'Euro' })).toBe('Euro');
  });

  it('drops a name that only repeats the code, so no select reads "USD — USD"', () => {
    expect(optionName({ code: 'USD', name: 'USD' })).toBeUndefined();
    expect(optionName({ code: 'USD', name: '  ' })).toBeUndefined();
    expect(optionName({ code: 'USD' })).toBeUndefined();
  });
});
