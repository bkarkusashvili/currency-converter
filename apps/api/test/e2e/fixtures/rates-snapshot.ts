import { RatesSnapshot } from '../../../src/modules/rates/domain/exchange-rate';

const QUOTED_AT = '2026-09-08T11:00:00.000Z';

// Small on purpose, and shaped like what Monobank publishes: the major pairs
// carry a spread, the thinner ones only a mid rate, and EUR/USD is the pair
// that never touches the hryvnia.
export const RATES_SNAPSHOT: RatesSnapshot = {
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: QUOTED_AT },
    { base: 'EUR', quote: 'UAH', buy: 51.7, sell: 52.4501, date: QUOTED_AT },
    { base: 'EUR', quote: 'USD', buy: 1.1655, sell: 1.1739, date: QUOTED_AT },
    { base: 'GBP', quote: 'UAH', cross: 60.7562, date: QUOTED_AT },
    { base: 'PLN', quote: 'UAH', cross: 12.1834, date: QUOTED_AT },
  ],
};

export const SNAPSHOT_CURRENCIES = [
  { code: 'EUR', numericCode: 978, name: 'Euro' },
  { code: 'GBP', numericCode: 826, name: 'Pound Sterling' },
  { code: 'PLN', numericCode: 985, name: 'Zloty' },
  { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
  { code: 'USD', numericCode: 840, name: 'US Dollar' },
];

// A snapshot with a currency the API knows and cannot price: CHF is quoted, but
// only against the dollar, so it has no leg to the hryvnia to cross through.
// Both codes of CHF/PLN are in the snapshot and there is still no path between
// them, which is the difference between the two 422s in §3.
export const DETACHED_RATES_SNAPSHOT: RatesSnapshot = {
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    { base: 'CHF', quote: 'USD', cross: 1.2543, date: QUOTED_AT },
    { base: 'PLN', quote: 'UAH', cross: 12.1834, date: QUOTED_AT },
  ],
};
