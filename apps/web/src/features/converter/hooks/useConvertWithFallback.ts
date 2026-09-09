import { useState } from 'react';
import { useConvert, useRatesSnapshot } from '../../../api';
import type { ConvertRequest } from '../../../api';
import {
  resolveConversionOutcome,
  type ConversionOutcome,
  type ConversionOutcomeState,
} from '../lib/conversionOutcome';

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
  const resolved = resolveConversionOutcome({
    data: conversion.data,
    error: conversion.error,
    request: conversion.variables,
    snapshot: snapshot.data,
    snapshotStatus: snapshot.status,
  });
  // The answer that was on screen when Convert was last pressed. The mutation
  // drops its data the moment the next request goes out, and the card would
  // drop the answer with it — the figure, the badges and the whole provenance
  // footer leaving and coming back around a press that changes one number.
  const [held, setHeld] = useState<ConversionOutcome | undefined>(undefined);

  return {
    ...resolved,
    // Only while a request is out, so a failure still empties the pane the way
    // it did rather than leaving the answer it did not produce standing.
    outcome: resolved.outcome ?? (conversion.isPending ? held : undefined),
    isPending: conversion.isPending,
    convert(request) {
      setHeld(resolved.outcome);
      conversion.mutate(request);
    },
  };
}
