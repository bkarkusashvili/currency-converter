import { createHttpConversionRepository } from './createHttpConversionRepository';
import { createHttpCurrenciesRepository } from './createHttpCurrenciesRepository';
import { createHttpHealthRepository } from './createHttpHealthRepository';
import { createHttpHistoryRepository } from './createHttpHistoryRepository';
import { createHttpRatesRepository } from './createHttpRatesRepository';
import type { Repositories } from './Repositories';

export function createHttpRepositories(): Repositories {
  return {
    conversion: createHttpConversionRepository(),
    currencies: createHttpCurrenciesRepository(),
    rates: createHttpRatesRepository(),
    history: createHttpHistoryRepository(),
    health: createHttpHealthRepository(),
  };
}
