import { PinoLogger } from 'nestjs-pino';

export interface OutageMessages {
  // Warned once, when the outage starts.
  down: string;
  // Debugged for every failure after the first. Omitted where the repeats are
  // not worth a line at all — a burst of conversions against a database that is
  // down would otherwise write one per request.
  stillDown?: string;
  // Logged at info when the outage ends. Omitted by a caller that reports the
  // recovery itself, because it has more to say about it than this does.
  restored?: string;
}

export interface OutageReporter {
  // Reports a failure. The first of an outage is a warning; the rest are the
  // same outage still being observed, not new ones.
  report(error?: unknown): void;
  // Ends the outage. Silent if nothing was reported, so a caller can clear
  // unconditionally on every success.
  clear(): void;
}

// Once per outage, not once per failure. All three of the places that need this
// — the Redis client's reconnect loop, the Mongo connection's state changes and
// the history writes that are being dropped — face the same thing: something is
// down, it will be observed again on every attempt for as long as it stays
// down, and the line that says what is wrong must not be buried under a
// thousand copies of itself.
//
// The error travels as pino's `err` field rather than in the message, which is
// what serialises a stack into the JSON line.
export function createOutageReporter(
  logger: PinoLogger,
  messages: OutageMessages,
): OutageReporter {
  let reported = false;

  return {
    report(error?: unknown): void {
      if (reported) {
        if (messages.stillDown !== undefined) {
          logger.debug({ err: error }, messages.stillDown);
        }

        return;
      }

      reported = true;

      if (error === undefined) {
        logger.warn(messages.down);
      } else {
        logger.warn({ err: error }, messages.down);
      }
    },

    clear(): void {
      if (!reported) {
        return;
      }

      reported = false;

      if (messages.restored !== undefined) {
        logger.info(messages.restored);
      }
    },
  };
}
