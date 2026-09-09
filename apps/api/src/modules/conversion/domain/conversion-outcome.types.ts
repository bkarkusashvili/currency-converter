import { ConversionResult } from './conversion-result.types';

// What one request produced: the conversion, and what degraded while it was
// being answered. The two are kept apart because they answer different
// questions — the result is what was converted, which is what /history stores
// and what a client reconciles against; the flags are facts about this request
// and nothing else.
//
// The service reports them; the controller turns them into §3's `warnings`,
// the same way /rates does. A transport field on the domain result would
// otherwise have to be omitted from every record written from it.
export interface ConversionOutcome {
  result: ConversionResult;
  // The cache could not be read from or written to while the rates for this
  // conversion were looked up. Straight from `RatesLookup.cacheDegraded`.
  cacheDegraded: boolean;
  // Whether the store took the record. `false` is not a failed conversion (§2)
  // — it is the one part of the answer the client cannot see for itself.
  recorded: boolean;
}
