import { useTranslation } from 'react-i18next';
import { Skeleton, WarningIcon } from '../../../components';
import { optionName, type CurrencyOption } from '../lib/currencyOptions';

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  currencies: readonly CurrencyOption[];
  /** The list is still on its way, so the select would otherwise offer two codes and then forty. */
  isLoading: boolean;
  /** A conversion is in flight: the trigger drops its chevron until it lands (board 1g). */
  isSubmitting: boolean;
  error: string | null;
  onChange: (code: string) => void;
}

export function CurrencySelect({
  id,
  label,
  value,
  currencies,
  isLoading,
  isSubmitting,
  error,
  onChange,
}: CurrencySelectProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;

  // A `label` needs the control it names. While the list is loading there is
  // none, so the same words are a caption instead of a dangling `for`.
  if (isLoading) {
    return (
      <div className="grid gap-3.5">
        <p className="field-label">{label}</p>
        <div role="status">
          <span className="sr-only">{t('converter.form.currenciesLoading', { field: label })}</span>
          <Skeleton className="h-12 w-full rounded-[0.625rem] sm:h-11" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="control control-select font-mono"
          value={value}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          {currencies.map((currency) => {
            const name = optionName(currency);

            return (
              <option key={currency.code} value={currency.code}>
                {name === undefined
                  ? currency.code
                  : t('converter.form.currencyOption', { code: currency.code, name })}
              </option>
            );
          })}
        </select>
        {/* Nothing is going to open while the card is waiting for an answer. */}
        {!isSubmitting && (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
            className="text-muted pointer-events-none absolute top-1/2 right-3.5 h-3 w-3 -translate-y-1/2"
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {error !== null && (
        <p id={errorId} role="alert" className="text-danger flex items-start gap-1.5 text-sm">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
