import type { ConversionRepository } from './ConversionRepository';
import type { CurrenciesRepository } from './CurrenciesRepository';
import type { HealthRepository } from './HealthRepository';
import type { HistoryRepository } from './HistoryRepository';

export interface Repositories {
  conversion: ConversionRepository;
  currencies: CurrenciesRepository;
  history: HistoryRepository;
  health: HealthRepository;
}
