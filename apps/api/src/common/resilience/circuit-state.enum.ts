// What the breaker will do with the next call: CLOSED lets it through, OPEN
// rejects it, HALF_OPEN admits exactly one trial.
export enum CircuitState {
  Closed = 'CLOSED',
  Open = 'OPEN',
  HalfOpen = 'HALF_OPEN',
}
