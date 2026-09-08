import { createHttpConversionRepository } from './createHttpConversionRepository';
import { createHttpCurrenciesRepository } from './createHttpCurrenciesRepository';
import { createHttpHealthRepository } from './createHttpHealthRepository';
import { createHttpHistoryRepository } from './createHttpHistoryRepository';
import type { Repositories } from './Repositories';

export function createHttpRepositories(): Repositories {
  return {
    conversion: createHttpConversionRepository(),
    currencies: createHttpCurrenciesRepository(),
    history: createHttpHistoryRepository(),
    health: createHttpHealthRepository(),
  };
}
