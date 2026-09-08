import { useTranslation } from 'react-i18next';
import { useCurrencies } from '../../../api/hooks/useCurrencies';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice';
import { useConvertWithFallback } from '../hooks/useConvertWithFallback';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { splitServerFieldErrors } from '../lib/serverFieldErrors';
import { ConversionResultCard } from './ConversionResultCard';
import { ConverterForm } from './ConverterForm';
import { HistoryPanel } from './HistoryPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  const currencies = useCurrencies();
  const conversion = useConvertWithFallback();

  const serverErrors = splitServerFieldErrors(conversion.error);

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

        <div aria-live="polite">
          {conversion.outcome !== undefined && (
            // Keyed by the answer, so a new one remounts the card and plays its
            // entrance again instead of swapping numbers in place.
            <ConversionResultCard
              key={outcomeKey(conversion.outcome)}
              result={conversion.outcome}
            />
          )}
        </div>
      </div>

      <HistoryPanel />
    </div>
  );
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
