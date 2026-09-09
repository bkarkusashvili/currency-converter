// How a conversion was priced, reported to the client so a rate can be read
// back: `cross` means two rates and two spreads were composed, `direct` one.
//
// Shared vocabulary rather than the conversion module's own: a stored record
// mirrors the conversion it came from, so the history schema, its DTO and the
// domain record all name a strategy too. Keeping it here is what lets the
// history module describe a record without importing from `conversion` (§9).
//
// A string enum rather than a union of literals: the member is the name every
// caller writes, and the value is the one the wire carries. The DTO and the
// Mongoose schema enumerate the set from this declaration, so a second copy of
// the literals cannot disagree with it.
export enum ConversionStrategyName {
  Identity = 'identity',
  Direct = 'direct',
  Cross = 'cross',
}
