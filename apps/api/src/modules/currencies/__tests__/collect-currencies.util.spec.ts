import { ExchangeRate } from '../../rates/domain/exchange-rate.types';
import { collectCurrencies } from '../collect-currencies.util';

const DATE = '2026-09-08T11:00:00.000Z';

function rate(base: string, quote: string): ExchangeRate {
  return { base, quote, cross: 1, date: DATE };
}

describe('collectCurrencies', () => {
  it('describes every code with its ISO 4217 name and numeric code', () => {
    expect(collectCurrencies([rate('EUR', 'UAH')])).toStrictEqual([
      { code: 'EUR', numericCode: 978, name: 'Euro' },
      { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
    ]);
  });

  it('takes both sides of a pair', () => {
    const codes = collectCurrencies([rate('EUR', 'USD')]).map(
      ({ code }) => code,
    );

    expect(codes).toContain('EUR');
    expect(codes).toContain('USD');
  });

  // A snapshot of crosses between foreign currencies never names the hryvnia,
  // and every one of those currencies is still convertible to it.
  it('always includes the base currency, even when no pair names it', () => {
    const codes = collectCurrencies([rate('EUR', 'USD')]).map(
      ({ code }) => code,
    );

    expect(codes).toContain('UAH');
  });

  it('reports a currency once however many pairs it appears in', () => {
    const codes = collectCurrencies([
      rate('USD', 'UAH'),
      rate('EUR', 'UAH'),
      rate('EUR', 'USD'),
    ]).map(({ code }) => code);

    expect(codes).toStrictEqual(['EUR', 'UAH', 'USD']);
  });

  it('sorts by code rather than by the order the upstream published', () => {
    const codes = collectCurrencies([
      rate('USD', 'UAH'),
      rate('GBP', 'UAH'),
      rate('CHF', 'UAH'),
    ]).map(({ code }) => code);

    expect(codes).toStrictEqual([...codes].sort());
  });

  it('answers with the base alone for an empty snapshot', () => {
    expect(collectCurrencies([])).toStrictEqual([
      { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
    ]);
  });

  it('drops a code the ISO 4217 table does not describe', () => {
    const codes = collectCurrencies([rate('XYZ', 'UAH')]).map(
      ({ code }) => code,
    );

    expect(codes).toStrictEqual(['UAH']);
  });
});
