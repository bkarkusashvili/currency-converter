import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencies, useRatesSnapshot } from '../../../api';
import type { ResponseWarning } from '../../../api';
import { ApiErrorNotice } from '../../../components';
import { useFormatters } from '../../../lib';
import { useConvertWithFallback } from '../hooks/useConvertWithFallback';
import { splitServerFieldErrors } from '../lib/serverFieldErrors';
import { historyHighlightKey } from '../lib/historyHighlight';
import { DEFAULT_FROM, DEFAULT_TO } from '../lib/currencyOptions';
import { ConverterCard } from './ConverterCard';
import { HistoryPanel } from './HistoryPanel';
import { RateHistoryPanel } from './RateHistoryPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const currencies = useCurrencies();
  // The same query `useConvertWithFallback` reads for the offline estimate;
  // here it is read for what it says about itself.
  const snapshot = useRatesSnapshot();
  const conversion = useConvertWithFallback();
  // The pair the card is on, which the rate-history panel below it follows.
  // The card owns the form; this is the one thing about it the page needs, and
  // it arrives on a pick or a swap rather than on a conversion (§5.2).
  const [pair, setPair] = useState({ from: DEFAULT_FROM, to: DEFAULT_TO });
  const onPairChange = useCallback((next: { from: string; to: string }) => {
    setPair(next);
  }, []);

  const serverErrors = splitServerFieldErrors(conversion.error);
  const formWarnings = distinctWarnings(currencies.data?.warnings, snapshot.data?.warnings);

  return (
    <div className="shell lg:grid lg:min-h-[40rem] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-14">
      <div className="grid gap-5 sm:gap-7">
        <div className="grid max-w-[40rem] gap-2.5 sm:gap-3">
          <p className="eyebrow">{t('converter.eyebrow')}</p>
          <h1 className="page-title">{t('converter.heading')}</h1>
          <p className="text-muted text-sm text-pretty sm:text-[0.9375rem]">
            {t('converter.intro')}
          </p>
        </div>

        <div className="grid gap-4">
          <ConverterCard
            currencies={currencies.data?.currencies}
            currenciesError={currencies.error}
            currenciesLoading={currencies.isPending}
            warnings={formWarnings}
            serverErrors={serverErrors.fields}
            isSubmitting={conversion.isPending}
            outcome={conversion.outcome}
            onSubmit={(request) => {
              conversion.convert(request);
            }}
            onPairChange={onPairChange}
          />

          {conversion.error !== null && (
            <ApiErrorNotice
              error={conversion.error}
              fieldErrors={serverErrors.rest}
              note={conversion.withoutSnapshot ? t('converter.offline.withoutSnapshot') : undefined}
            />
          )}
        </div>

        {/* The answer, in one sentence. The pane itself is outside this region:
            announcing it whole reads every badge, both rate directions, the
            path and two provenance notes before the number, and it stays
            available to read at leisure in the card. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {conversion.outcome !== undefined &&
            t('converter.result.announcement', {
              amount: formatters.money(conversion.outcome.amount),
              from: conversion.outcome.from,
              result: formatters.money(conversion.outcome.result),
              to: conversion.outcome.to,
            })}
        </div>

        {/* Below the card, never in front of it: the panel loads, empties and
            fails on its own, and Convert above it is never waiting on any of
            that (§3.18). */}
        <RateHistoryPanel base={pair.from.toUpperCase()} quote={pair.to.toUpperCase()} />
      </div>

      {/* Beside the card where there is room for a 320px column, below it where
          there is not. Either way it is the same panel reading the same query. */}
      <aside className="mt-7 lg:mt-0 lg:pt-1">
        <HistoryPanel highlight={historyHighlightKey(conversion.outcome)} />
      </aside>
    </div>
  );
}

/**
 * Two queries can report the same degradation — a cache that is down is down
 * for both — and the form has one line to say it on.
 */
function distinctWarnings(...lists: (ResponseWarning[] | undefined)[]): ResponseWarning[] {
  const byCode = new Map<string, ResponseWarning>();

  for (const warning of lists.flatMap((list) => list ?? [])) {
    if (!byCode.has(warning.code)) {
      byCode.set(warning.code, warning);
    }
  }

  return [...byCode.values()];
}
