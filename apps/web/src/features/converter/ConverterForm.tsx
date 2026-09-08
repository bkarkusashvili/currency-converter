import type { ApiError } from '../../api/errors';
import type { ConvertRequest, Currency } from '../../api/types';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';
import { useConverterForm } from './useConverterForm';

interface ConverterFormProps {
  currencies: Currency[];
  currenciesError: ApiError | null;
  isSubmitting: boolean;
  onSubmit: (request: ConvertRequest) => void;
}

export function ConverterForm({
  currencies,
  currenciesError,
  isSubmitting,
  onSubmit,
}: ConverterFormProps) {
  const form = useConverterForm(onSubmit);

  return (
    <form className="card p-5 sm:p-7" onSubmit={form.handleSubmit} noValidate>
      <div>
        <label className="field-label" htmlFor="amount">
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          className="control control-amount"
          inputMode="decimal"
          autoComplete="off"
          value={form.amount}
          aria-invalid={form.amountError !== null}
          aria-describedby={form.amountError === null ? undefined : 'amount-error'}
          onChange={(event) => {
            form.setAmount(event.target.value);
          }}
        />
        {form.amountError !== null && (
          <p id="amount-error" role="alert" className="text-danger mt-2 text-sm">
            {form.amountError}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <CurrencySelect
            id="from"
            label="From"
            value={form.from}
            currencies={currencies}
            onChange={form.setFrom}
          />
        </div>
        <SwapButton onClick={form.swap} />
        <div className="sm:flex-1">
          <CurrencySelect
            id="to"
            label="To"
            value={form.to}
            currencies={currencies}
            onChange={form.setTo}
          />
        </div>
      </div>

      {currenciesError !== null && (
        <p className="text-muted mt-3 text-sm">
          The currency list did not load ({currenciesError.message}) — the two defaults are still
          available.
        </p>
      )}

      <button
        type="submit"
        className="button button-primary mt-6 w-full sm:w-auto sm:min-w-44"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Converting…' : 'Convert'}
      </button>
    </form>
  );
}
