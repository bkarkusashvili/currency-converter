import { useTranslation } from 'react-i18next';
import type { ApiError } from '../../../api/http/ApiError';
import type { ConvertRequest, Currency } from '../../../api/types';
import { useConverterForm } from '../hooks/useConverterForm';
import type { FormFieldErrors } from '../lib/serverFieldErrors';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';

interface ConverterFormProps {
  currencies: Currency[];
  currenciesError: ApiError | null;
  serverErrors: FormFieldErrors;
  isSubmitting: boolean;
  onSubmit: (request: ConvertRequest) => void;
}

export function ConverterForm({
  currencies,
  currenciesError,
  serverErrors,
  isSubmitting,
  onSubmit,
}: ConverterFormProps) {
  const { t } = useTranslation();
  const form = useConverterForm({ serverErrors, onSubmit });

  return (
    <form className="card p-5 sm:p-7" onSubmit={form.handleSubmit} noValidate>
      <div>
        <label className="field-label" htmlFor="amount">
          {t('converter.form.amount')}
        </label>
        <input
          id="amount"
          name="amount"
          className="control control-amount"
          inputMode="decimal"
          autoComplete="off"
          value={form.amount}
          aria-invalid={form.errors.amount !== null}
          aria-describedby={form.errors.amount === null ? undefined : 'amount-error'}
          onChange={(event) => {
            form.setAmount(event.target.value);
          }}
        />
        {form.errors.amount !== null && (
          <p id="amount-error" role="alert" className="text-danger mt-2 text-sm">
            {form.errors.amount}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <CurrencySelect
            id="from"
            label={t('converter.form.from')}
            value={form.from}
            currencies={currencies}
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
            currencies={currencies}
            error={form.errors.to}
            onChange={form.setTo}
          />
        </div>
      </div>

      {currenciesError !== null && (
        <p className="text-muted mt-3 text-sm">
          {t('converter.form.currenciesUnavailable', { message: currenciesError.message })}
        </p>
      )}

      <button
        type="submit"
        className="button button-primary mt-6 w-full sm:w-auto sm:min-w-44"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? t('converter.form.submitting') : t('converter.form.submit')}
      </button>
    </form>
  );
}
