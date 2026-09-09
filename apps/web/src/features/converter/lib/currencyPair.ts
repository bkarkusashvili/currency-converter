/**
 * The two codes the form is on. A type of its own because it is state two
 * components read — the card's selects and the rate-history panel under them —
 * and passing it around as a pair keeps a swap one change rather than two.
 */
export interface CurrencyPair {
  from: string;
  to: string;
}
