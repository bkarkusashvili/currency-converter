import {
  ResponseWarning,
  WARNING_CODES,
  WarningCode,
} from './response-warning';

// The sentence each code carries, in one place: the message is part of the
// contract a client renders, and two wordings for the same degradation is what
// composing it at each call site would produce.
const MESSAGES: Record<WarningCode, string> = {
  CACHE_UNAVAILABLE:
    'The rates cache could not be reached, so these rates were fetched from ' +
    'the upstream and could not be cached for the next request.',
  HISTORY_NOT_RECORDED:
    'The conversion was answered but could not be written to the history ' +
    'store, so it will not appear in /history.',
};

// Absent rather than empty when nothing degraded. `warnings` exists to be
// noticed, and an array on every successful response is one a client has to
// look inside before it knows there is nothing to show — and one every existing
// caller would start receiving on a healthy request.
export function collectWarnings(
  degradations: Partial<Record<WarningCode, boolean>>,
): ResponseWarning[] | undefined {
  const warnings = WARNING_CODES.filter(
    (code) => degradations[code] === true,
  ).map((code) => ({ code, message: MESSAGES[code] }));

  return warnings.length > 0 ? warnings : undefined;
}
