import { useConvert } from '../../../api/hooks/useConvert';
import { useRatesSnapshot } from '../../../api/hooks/useRatesSnapshot';
import type { ConvertRequest } from '../../../api/types';
import { resolveConversionOutcome, type ConversionOutcomeState } from '../lib/conversionOutcome';

export interface ConversionState extends ConversionOutcomeState {
  isPending: boolean;
  convert: (request: ConvertRequest) => void;
}

/**
 * `useConvert` stays what it is — the mutation against the API — and this
 * composes the second layer on top: the persisted snapshot, and the rule for
 * when an estimate stands in for an answer. Because the mutation never
 * succeeds in that case, the history query is not invalidated and the estimate
 * is not recorded anywhere, which is the intended behaviour rather than an
 * omission: history is the API's list of what it converted.
 */
export function useConvertWithFallback(): ConversionState {
  const conversion = useConvert();
  const snapshot = useRatesSnapshot();

  return {
    ...resolveConversionOutcome({
      data: conversion.data,
      error: conversion.error,
      request: conversion.variables,
      snapshot: snapshot.data,
    }),
    isPending: conversion.isPending,
    convert: conversion.mutate,
  };
}
