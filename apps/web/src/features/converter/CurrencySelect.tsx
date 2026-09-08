import type { Currency } from '../../api/types';

interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  currencies: Currency[];
  disabled?: boolean;
  onChange: (code: string) => void;
}

export function CurrencySelect({
  id,
  label,
  value,
  currencies,
  disabled = false,
  onChange,
}: CurrencySelectProps) {
  const options: { code: string; name: string }[] =
    currencies.length > 0 ? currencies : [{ code: value, name: value }];

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="control font-mono"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code} — {currency.name}
          </option>
        ))}
      </select>
    </div>
  );
}
