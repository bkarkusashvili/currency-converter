import { useTranslation } from 'react-i18next';
import { optionName, type CurrencyOption } from '../lib/currencyOptions';

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  currencies: readonly CurrencyOption[];
  error: string | null;
  onChange: (code: string) => void;
}

export function CurrencySelect({
  id,
  label,
  value,
  currencies,
  error,
  onChange,
}: CurrencySelectProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="control font-mono"
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
      {error !== null && (
        <p id={errorId} role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
