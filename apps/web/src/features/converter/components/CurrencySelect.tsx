import { useTranslation } from 'react-i18next';
import type { Currency } from '../../../api/types';

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  currencies: Currency[];
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
  const options = currencies.length > 0 ? currencies : [{ code: value, name: value }];
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
        {options.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {t('converter.form.currencyOption', { code: currency.code, name: currency.name })}
          </option>
        ))}
      </select>
      {error !== null && (
        <p id={errorId} role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
