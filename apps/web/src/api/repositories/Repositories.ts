import type { ConversionRepository } from './ConversionRepository';
import type { CurrenciesRepository } from './CurrenciesRepository';
import type { HealthRepository } from './HealthRepository';
import type { HistoryRepository } from './HistoryRepository';
import type { RatesRepository } from './RatesRepository';

export interface Repositories {
  conversion: ConversionRepository;
  currencies: CurrenciesRepository;
  rates: RatesRepository;
  history: HistoryRepository;
  health: HealthRepository;
}
