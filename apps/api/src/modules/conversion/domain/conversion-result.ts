import { RatesSource } from '../../rates/domain/rates-source';
import { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name';
import { ConversionRequest } from './conversion-request';

// A whole conversion: the request it answered, the numbers it produced, and the
// provenance of the rates it used. Nothing about the request that produced it:
// this is what /history stores, and it is structurally `NewConversionRecord`,
// which is what lets the service hand over what it answered without assembling
// a second, narrower copy.
//
// What degraded while the request ran travels beside it on `ConversionOutcome`,
// and becomes the response's `warnings` in the controller (§3).
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
