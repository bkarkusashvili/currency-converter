import { CurrencyCode } from '../../../common/currency';
import { ConversionStrategyName } from '../../../common/conversion';
import { RatesSource } from '../../rates';

// A conversion as the API answered it. The provenance travels with the numbers:
// a result priced from the stale fallback cannot be reconciled against the rate
// that was live at the time without knowing that is what happened.
export interface ConversionRecord {
  id: string;
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategyName;
  source: RatesSource;
  // fetchedAt of the snapshot that priced it, ISO 8601.
  ratesTimestamp: string;
  // When the record was written, ISO 8601. The domain publishes the string the
  // API does, so the driver's Date stays inside the adapter that produced it.
  createdAt: string;
}

// What a caller supplies: the identity and the timestamp belong to the store.
// It is exactly a ConversionResult, which is what lets the conversion hand over
// what it just answered without assembling a second, narrower copy.
export type NewConversionRecord = Omit<ConversionRecord, 'id' | 'createdAt'>;
