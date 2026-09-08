import { ResponseWarning } from '../../../common/warnings/response-warning';
import { RatesSource } from '../../rates/domain/rates-source';
import { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name';
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
  // What degraded while this conversion was answered, absent when nothing did.
  // It belongs to the answer rather than to the conversion: a record of what
  // was converted is the same record whether or not the cache was up while it
  // happened, so `NewConversionRecord` does not carry it and the history never
  // sees one.
  warnings?: ResponseWarning[];
}
