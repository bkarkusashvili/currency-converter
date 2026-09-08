// What the Nest logger takes as its second argument: a stack, as a string. The
// two places that use it are the bootstrap paths, where the pino logger is
// either not resolved yet or being flushed, so `{ err }` is not available and
// the stack has to be spelled out.
export function errorStack(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
