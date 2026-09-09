import type { HistoryItem } from '../../../api';
import type { ConversionOutcome } from './conversionOutcome';

/**
 * Which recorded conversion the answer on screen produced. The API assigns the
 * id, and the client never sees it on the response it just got, so the two are
 * matched on the five fields that identify one conversion of one rate — the
 * key §5 suggests — rather than on the order the list came back in.
 *
 * An estimate is never recorded, so it can never match a row: `null` says
 * there is nothing to highlight rather than "highlight the newest".
 */
export function conversionKey(
  conversion: Pick<HistoryItem, 'from' | 'to' | 'amount' | 'result' | 'ratesTimestamp'>,
): string {
  return [
    conversion.from,
    conversion.to,
    conversion.amount,
    conversion.result,
    conversion.ratesTimestamp,
  ].join('|');
}

export function historyHighlightKey(outcome: ConversionOutcome | undefined): string | null {
  return outcome === undefined ? null : conversionKey(outcome);
}
