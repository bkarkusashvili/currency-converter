import type { HistoryItem } from '../../../api';

/**
 * The five fields that identify one conversion of one rate — the key §5
 * suggests. The API assigns the id, and the client never sees it on the
 * response it has just been handed, so anything that has to recognise one
 * conversion across two places is matched on these fields rather than on the
 * order a list came back in: the history row an answer produced, and the
 * output pane's key, which remounts when the answer changes.
 */
export function conversionIdentity(
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
