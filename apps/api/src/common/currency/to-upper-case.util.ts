// class-transformer types a transform's value as `any`, which would spread into
// every DTO that used one inline; taking it as unknown here is what keeps them
// free of it.
//
// A value that is not a string is passed through untouched, so what a caller
// sees is the type error class-validator reports for the field rather than a
// TypeError raised while preparing to validate it.
export function toUpperCase({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.toUpperCase() : value;
}
