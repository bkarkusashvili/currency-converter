// Something that degraded while a request was answered, reported on the answer
// rather than only in the log. The request succeeded — that is what separates a
// warning from the error envelope (§3): the client has a result, and this is
// what it should know about how it was produced.
//
// The list is the value and the type is read off it, the way RATES_SOURCES is:
// the DTO has to enumerate the codes for OpenAPI, and a second copy of the
// literals is one that can disagree with this one.
export const WARNING_CODES = [
  'CACHE_UNAVAILABLE',
  'HISTORY_NOT_RECORDED',
] as const;

export type WarningCode = (typeof WARNING_CODES)[number];

export interface ResponseWarning {
  code: WarningCode;
  message: string;
}
