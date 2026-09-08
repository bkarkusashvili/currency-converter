import { CurrencyCode } from '../../../common/currency/currency-code';

// Monobank is a Ukrainian bank: every pair it publishes is either against the
// hryvnia or between two foreign currencies, and UAH is what a cross rate
// routes through. It is a property of the rate source, not of a conversion.
export const BASE_CURRENCY: CurrencyCode = 'UAH';
