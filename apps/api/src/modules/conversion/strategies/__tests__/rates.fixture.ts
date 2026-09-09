import { ExchangeRate } from '../../../rates/domain/exchange-rate.types';

const QUOTED_AT = '2026-09-08T11:00:00.000Z';

// Shaped like what Monobank publishes and shared by the strategy suites: the
// major pairs carry a spread, the thinner ones only a mid rate, and EUR/USD is
// the pair that never touches the hryvnia.
export const RATES: readonly ExchangeRate[] = [
  { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: QUOTED_AT },
  { base: 'EUR', quote: 'UAH', buy: 51.7, sell: 52.4501, date: QUOTED_AT },
  { base: 'EUR', quote: 'USD', buy: 1.1655, sell: 1.1739, date: QUOTED_AT },
  { base: 'GBP', quote: 'UAH', cross: 60.7562, date: QUOTED_AT },
  { base: 'PLN', quote: 'UAH', cross: 12.1834, date: QUOTED_AT },
];
