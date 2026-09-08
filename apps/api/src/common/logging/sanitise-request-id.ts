// An inbound id is echoed back to the caller and written on every log line for
// the request, so it is bounded and restricted to characters that cannot break
// a log parser or a downstream header. An id that does not qualify is dropped
// rather than truncated: a truncated id would silently merge distinct traces.
const MAX_LENGTH = 128;
const ALLOWED_CHARACTERS = /^[A-Za-z0-9._-]+$/;

export function sanitiseRequestId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.trim();

  if (candidate.length === 0 || candidate.length > MAX_LENGTH) {
    return null;
  }

  return ALLOWED_CHARACTERS.test(candidate) ? candidate : null;
}
