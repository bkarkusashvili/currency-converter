// Internal to the resilience layer: it says the call was never attempted, not
// that the upstream failed. RatesService translates it into the public
// RatesUnavailableError, so it deliberately does not extend AppError and can
// never reach the client on its own.
export class CircuitOpenError extends Error {
  constructor(message = 'The circuit is open') {
    super(message);
    this.name = CircuitOpenError.name;
  }
}
