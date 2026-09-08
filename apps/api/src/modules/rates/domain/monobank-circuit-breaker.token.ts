// The provider and the health indicator have to share one breaker instance:
// an indicator with a breaker of its own would report a circuit nothing trips.
export const MONOBANK_CIRCUIT_BREAKER = Symbol('MONOBANK_CIRCUIT_BREAKER');
