import { ApiErrorNotice } from '../../components/ApiErrorNotice';
import { useConvert } from '../../api/useConvert';
import { useCurrencies } from '../../api/useCurrencies';
import { ConversionResultCard } from './ConversionResultCard';
import { ConverterForm } from './ConverterForm';
import { HistoryPanel } from './HistoryPanel';

export function ConverterPage() {
  const currencies = useCurrencies();
  const conversion = useConvert();

  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow">Monobank rates · cross rates through UAH</p>
      <h1 className="mt-3 max-w-xl text-[clamp(1.9rem,5.5vw,2.75rem)]">
        Convert at a rate you can trace.
      </h1>
      <p className="text-muted mt-4 max-w-xl">
        Every conversion reports the strategy that produced the rate and whether it came from the
        cache, from Monobank, or from the last good snapshot.
      </p>

      <div className="mt-9 grid gap-4">
        <ConverterForm
          currencies={currencies.data?.currencies ?? []}
          currenciesError={currencies.error}
          isSubmitting={conversion.isPending}
          onSubmit={(request) => {
            conversion.mutate(request);
          }}
        />

        {conversion.error !== null && <ApiErrorNotice error={conversion.error} />}
        {conversion.data !== undefined && <ConversionResultCard result={conversion.data} />}
      </div>

      <HistoryPanel />
    </div>
  );
}
