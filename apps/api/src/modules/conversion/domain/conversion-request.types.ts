import { CurrencyCode } from '../../../common/currency';

// A conversion as the application layer takes it: codes already normalised to
// upper case and an amount already known to be a finite positive number. The
// DTO is what enforces that at the HTTP boundary.
export interface ConversionRequest {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
}
