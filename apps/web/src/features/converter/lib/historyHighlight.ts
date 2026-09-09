import { conversionIdentity } from './conversionIdentity';
import type { ConversionOutcome } from './conversionOutcome';
import { OFFLINE_ESTIMATE } from './provenance';

/**
 * Which recorded conversion the answer on screen produced, as the identity the
 * history panel matches its rows on.
 *
 * An estimate is priced in this browser and never reaches the API, so it is
 * never recorded and can never match a row: `null` says there is nothing to
 * highlight rather than leaving a row from an earlier answer tinted.
 */
export function historyHighlightKey(outcome: ConversionOutcome | undefined): string | null {
  return outcome === undefined || outcome.source === OFFLINE_ESTIMATE
    ? null
    : conversionIdentity(outcome);
}
