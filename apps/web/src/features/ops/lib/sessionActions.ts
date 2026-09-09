/** One line of the log the Operations page keeps for the length of a visit. */
export interface SessionAction {
  id: string;
  /** When the answer arrived, as an ISO instant; the row renders it as a clock. */
  at: string;
  method: string;
  path: string;
  status: number;
  outcome: 'cleared' | 'unauthorized' | 'failed';
  /** From the envelope on a failure, or the `x-request-id` header on a success. */
  requestId: string | undefined;
}

/**
 * `request 3b91…e0` — enough of the id to match a log line against, short
 * enough not to push the status off the end of a 360px row.
 */
export function shortenRequestId(requestId: string): string {
  return requestId.length <= 8 ? requestId : `${requestId.slice(0, 4)}…${requestId.slice(-2)}`;
}

/** Which of the three outcomes the log names a status by. */
export function outcomeOf(status: number): SessionAction['outcome'] {
  if (status === 204) {
    return 'cleared';
  }

  return status === 401 ? 'unauthorized' : 'failed';
}
