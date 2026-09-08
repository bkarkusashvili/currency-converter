import { useTranslation } from 'react-i18next';
import { useConvert } from '../../../api/hooks/useConvert';
import { useCurrencies } from '../../../api/hooks/useCurrencies';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice';
import { splitServerFieldErrors } from '../lib/serverFieldErrors';
import { ConversionResultCard } from './ConversionResultCard';
import { ConverterForm } from './ConverterForm';
import { HistoryPanel } from './HistoryPanel';

export function ConverterPage() {
  const { t } = useTranslation();
  const currencies = useCurrencies();
  const conversion = useConvert();

  const serverErrors = splitServerFieldErrors(conversion.error);

  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow">{t('converter.eyebrow')}</p>
      <h1 className="mt-3 max-w-xl text-[clamp(1.9rem,5.5vw,2.75rem)]">{t('converter.heading')}</h1>
      <p className="text-muted mt-4 max-w-xl">{t('converter.intro')}</p>

      <div className="mt-9 grid gap-4">
        <ConverterForm
          currencies={currencies.data?.currencies ?? []}
          currenciesError={currencies.error}
          serverErrors={serverErrors.fields}
          isSubmitting={conversion.isPending}
          onSubmit={(request) => {
            conversion.mutate(request);
          }}
        />

        {conversion.error !== null && (
          <ApiErrorNotice error={conversion.error} fieldErrors={serverErrors.rest} />
        )}

        <div aria-live="polite">
          {conversion.data !== undefined && <ConversionResultCard result={conversion.data} />}
        </div>
      </div>

      <HistoryPanel />
    </div>
  );
}
