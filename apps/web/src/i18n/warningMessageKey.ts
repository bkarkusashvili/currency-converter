import type { ResponseWarningCode } from '../api/types';

/**
 * The warning codes §3 defines, each with the sentence this client shows for
 * it. The API sends a message of its own — a client renders the translated one
 * and keeps the server's for a code it has not been taught yet, the same
 * bargain `errorMessageKey` makes for the envelope.
 */
const WARNING_MESSAGE_KEYS = {
  CACHE_UNAVAILABLE: 'warnings.CACHE_UNAVAILABLE',
  HISTORY_NOT_RECORDED: 'warnings.HISTORY_NOT_RECORDED',
} as const satisfies Record<ResponseWarningCode, string>;

export type WarningMessageKey = (typeof WARNING_MESSAGE_KEYS)[keyof typeof WARNING_MESSAGE_KEYS];

export function warningMessageKey(code: string): WarningMessageKey | null {
  return Object.hasOwn(WARNING_MESSAGE_KEYS, code)
    ? WARNING_MESSAGE_KEYS[code as keyof typeof WARNING_MESSAGE_KEYS]
    : null;
}
