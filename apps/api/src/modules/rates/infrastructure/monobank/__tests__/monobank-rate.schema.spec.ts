import { monobankRatesSchema } from '../monobank-rate.schema';

const USD_UAH = {
  currencyCodeA: 840,
  currencyCodeB: 980,
  date: 1_757_332_800,
  rateBuy: 44.35,
  rateSell: 44.831,
};

describe('monobankRatesSchema', () => {
  it('accepts the payload shape the upstream publishes', () => {
    expect(monobankRatesSchema.parse([USD_UAH])).toStrictEqual([USD_UAH]);
  });

  it('accepts an entry quoted with a cross rate only', () => {
    const crossOnly = {
      currencyCodeA: 826,
      currencyCodeB: 980,
      date: 1_757_332_800,
      rateCross: 60.7562,
    };

    expect(monobankRatesSchema.parse([crossOnly])).toStrictEqual([crossOnly]);
  });

  // A field the upstream adds must not be able to take this API down.
  it('ignores fields it does not read', () => {
    expect(
      monobankRatesSchema.parse([{ ...USD_UAH, rateNew: 1 }]),
    ).toStrictEqual([USD_UAH]);
  });

  it.each([
    ['a payload that is not an array', { currencyCodeA: 840 }],
    ['a missing currency code', [{ currencyCodeB: 980, date: 1 }]],
    [
      'a currency code that is not a number',
      [{ ...USD_UAH, currencyCodeA: 'USD' }],
    ],
    ['a date that is not a number', [{ ...USD_UAH, date: '2026-09-08' }]],
    ['a negative rate', [{ ...USD_UAH, rateBuy: -1 }]],
    ['a zero rate', [{ ...USD_UAH, rateSell: 0 }]],
  ])('rejects %s', (_case, payload) => {
    expect(monobankRatesSchema.safeParse(payload).success).toBe(false);
  });
});
