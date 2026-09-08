import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiError } from '../../../api/http/ApiError';
import type { ConvertRequest, Currency } from '../../../api/types';
import { Spinner } from '../../../components/Spinner';
import { useApiErrorMessage } from '../../../lib/useApiErrorMessage';
import { useFormatters } from '../../../lib/useFormatters';
import { useConverterForm } from '../hooks/useConverterForm';
import { currencyOptions } from '../lib/currencyOptions';
import { MAX_FRACTION_DIGITS } from '../lib/formatAmountInput';
import { MAX_AMOUNT } from '../lib/parseAmount';
import type { FormFieldErrors } from '../lib/serverFieldErrors';
import { AmountField } from './AmountField';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';

interface ConverterFormProps {
  /** Undefined until the list loads, and after a failure that no persisted copy answered. */
  currencies: Currency[] | undefined;
  currenciesError: ApiError | null;
  /** No list has arrived and none was stored, so the selects have nothing to offer yet. */
  currenciesLoading: boolean;
  serverErrors: FormFieldErrors;
  isSubmitting: boolean;
  onSubmit: (request: ConvertRequest) => void;
}

export function ConverterForm({
  currencies,
  currenciesError,
  currenciesLoading,
  serverErrors,
  isSubmitting,
  onSubmit,
}: ConverterFormProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const messageOf = useApiErrorMessage();
  const amountRef = useRef<HTMLInputElement>(null);
  const form = useConverterForm({
    serverErrors,
    onSubmit,
    onAmountInvalid: () => amountRef.current?.focus(),
  });
  const options = currencyOptions(currencies);
  // A failed request whose persisted copy is answering is a different sentence
  // from one that left the form with nothing but its defaults.
  const hintKey =
    currencies === undefined || currencies.length === 0
      ? 'converter.form.currenciesUnavailable'
      : 'converter.form.currenciesFromCache';

  return (
    <form className="card p-5 sm:p-7" onSubmit={form.handleSubmit} noValidate>
      <AmountField
        id="amount"
        label={t('converter.form.amount')}
        hint={t('converter.form.amountHint', {
          decimals: MAX_FRACTION_DIGITS,
          max: formatters.integer(MAX_AMOUNT),
        })}
        value={form.amount}
        error={form.errors.amount}
        separators={formatters.separators}
        inputRef={amountRef}
        onChange={form.setAmount}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <CurrencySelect
            id="from"
            label={t('converter.form.from')}
            value={form.from}
            currencies={options}
            isLoading={currenciesLoading}
            error={form.errors.from}
            onChange={form.setFrom}
          />
        </div>
        <SwapButton onClick={form.swap} />
        <div className="sm:flex-1">
          <CurrencySelect
            id="to"
            label={t('converter.form.to')}
            value={form.to}
            currencies={options}
            isLoading={currenciesLoading}
            error={form.errors.to}
            onChange={form.setTo}
          />
        </div>
      </div>

      {currenciesError !== null && (
        <p className="text-muted mt-3 text-sm">
          {t(hintKey, { message: messageOf(currenciesError) })}
        </p>
      )}

      <button
        type="submit"
        className="button button-primary mt-6 w-full sm:w-auto sm:min-w-44"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting && <Spinner className="h-4 w-4" />}
        {isSubmitting ? t('converter.form.submitting') : t('converter.form.submit')}
      </button>
    </form>
  );
}
