import { ResponseWarning } from './response-warning.types';
import { WarningCode } from './warning-code.enum';

// The sentence each code carries, in one place: the message is part of the
// contract a client renders, and two wordings for the same degradation is what
// composing it at each call site would produce.
const MESSAGES: Record<WarningCode, string> = {
  // Provenance-neutral on purpose. The flag behind this code is raised by any
  // of three things — a read that failed, a write that failed, or both — so
  // "these rates came from the upstream" would be false for a fresh-read
  // timeout whose save then succeeded, and false again for a degraded read
  // answered from the stale key. `source` is the field that says where the
  // rates came from, and it is on the same response.
  [WarningCode.CacheUnavailable]:
    'The rates cache could not be reached during this request, so it was not ' +
    'used; `source` says where the rates came from.',
  [WarningCode.HistoryNotRecorded]:
    'The conversion was answered but could not be written to the history ' +
    'store, so it will not appear in /history.',
  // Says nothing about where these rates came from either: what was dropped is
  // the archiving of a snapshot that was fetched successfully, so the answer
  // itself is as fresh as it looks. What it costs is the day this snapshot
  // would have been the archived one for.
  [WarningCode.ArchiveNotRecorded]:
    "The rates were fetched but today's snapshot could not be archived, so " +
    'it will not appear in /rates/history and cannot back a later fallback.',
};

// Absent rather than empty when nothing degraded. `warnings` exists to be
// noticed, and an array on every successful response is one a client has to
// look inside before it knows there is nothing to show — and one every existing
// caller would start receiving on a healthy request.
export function collectWarnings(
  degradations: Partial<Record<WarningCode, boolean>>,
): ResponseWarning[] | undefined {
  const warnings = Object.values(WarningCode)
    .filter((code) => degradations[code] === true)
    .map((code) => ({ code, message: MESSAGES[code] }));

  return warnings.length > 0 ? warnings : undefined;
}
