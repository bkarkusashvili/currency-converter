import { RatesSource } from '../../rates/domain/rates-source';
import { ConversionStrategyName } from '../strategies/conversion-strategy-name';
import { ConversionRequest } from './conversion-request';

// A whole conversion: the request it answered, the numbers it produced, and the
// provenance of the rates it used. The service returns this rather than the
// response shape, so the history module can record what happened without the
// controller having to hand it a second, narrower copy.
export interface ConversionResult extends ConversionRequest {
  // amount × the unrounded rate, half-up to RESULT_DECIMALS.
  result: number;
  // The effective to-per-from rate, half-up to RATE_DECIMALS.
  rate: number;
  strategy: ConversionStrategyName;
  source: RatesSource;
  // fetchedAt of the snapshot the rate came from, ISO 8601.
  ratesTimestamp: string;
}
