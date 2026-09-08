import { useTranslation } from 'react-i18next';
import { useCurrencies } from '../../../api/hooks/useCurrencies';
import { useRatesSnapshot } from '../../../api/hooks/useRatesSnapshot';
import type { ResponseWarning } from '../../../api/types';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice';
import { useFormatters } from '../../../lib/useFormatters';
import { useConvertWithFallback } from '../hooks/useConvertWithFallback';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { splitServerFieldErrors } from '../lib/serverFieldErrors';
import { ConversionResultCard } from './ConversionResultCard';
import { ConverterForm } from './ConverterForm';
import { HistoryPanel } from './HistoryPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const currencies = useCurrencies();
  // The same query `useConvertWithFallback` reads for the offline estimate;
  // here it is read for what it says about itself.
  const snapshot = useRatesSnapshot();
  const conversion = useConvertWithFallback();

  const serverErrors = splitServerFieldErrors(conversion.error);
  const formWarnings = distinctWarnings(currencies.data?.warnings, snapshot.data?.warnings);

  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow">{t('converter.eyebrow')}</p>
      <h1 className="mt-3 max-w-xl text-[clamp(1.9rem,5.5vw,2.75rem)] text-balance">
        {t('converter.heading')}
      </h1>
      <p className="text-muted mt-4 max-w-xl text-pretty">{t('converter.intro')}</p>

      <div className="mt-9 grid gap-4">
        <ConverterForm
          currencies={currencies.data?.currencies}
          currenciesError={currencies.error}
          currenciesLoading={currencies.isPending}
          warnings={formWarnings}
          serverErrors={serverErrors.fields}
          isSubmitting={conversion.isPending}
          onSubmit={(request) => {
            conversion.convert(request);
          }}
        />

        {conversion.error !== null && (
          <ApiErrorNotice
            error={conversion.error}
            fieldErrors={serverErrors.rest}
            note={conversion.withoutSnapshot ? t('converter.offline.withoutSnapshot') : undefined}
          />
        )}

        {/* The answer, in one sentence. The card itself is outside this region:
            announcing it whole reads every badge, both rate directions, the
            path and two provenance notes before the number, and it stays
            available to read at leisure below. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {conversion.outcome !== undefined &&
            t('converter.result.announcement', {
              amount: formatters.money(conversion.outcome.amount),
              from: conversion.outcome.from,
              result: formatters.money(conversion.outcome.result),
              to: conversion.outcome.to,
            })}
        </div>

        {conversion.outcome !== undefined && (
          // Keyed by the answer, so a new one remounts the card and plays its
          // entrance again instead of swapping numbers in place.
          <ConversionResultCard key={outcomeKey(conversion.outcome)} result={conversion.outcome} />
        )}
      </div>

      <HistoryPanel />
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

function outcomeKey(outcome: ConversionOutcome): string {
  return [
    outcome.from,
    outcome.to,
    outcome.amount,
    outcome.result,
    outcome.rate,
    outcome.source,
    outcome.ratesTimestamp,
  ].join('|');
}
