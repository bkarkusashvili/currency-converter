import { RatesSnapshot } from './rates-snapshot';
import { RatesSource } from './rates-source';

export interface RatesLookup {
  snapshot: RatesSnapshot;
  source: RatesSource;
}
