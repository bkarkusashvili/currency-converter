// Distinguishes "the work took too long" from "the work failed", which is what
// lets a caller report the difference without reading a driver's message.
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms`);
    this.name = TimeoutError.name;
  }
}
