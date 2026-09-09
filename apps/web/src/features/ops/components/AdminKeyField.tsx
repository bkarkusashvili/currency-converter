import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

interface AdminKeyFieldProps {
  value: string;
  /** The last answer was a 401, so the field is what needs fixing. */
  invalid: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}

/**
 * The admin key, held in React state for as long as the tab is open and
 * written nowhere else: not `localStorage`, not `sessionStorage`, not a query
 * key, and never a log line (§5.2). Masked by default, with a reveal for
 * checking a paste, and a Forget button that empties it on the spot.
 */
export function AdminKeyField({ value, invalid, inputRef, onChange }: AdminKeyFieldProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="grid gap-2 sm:min-w-[22.5rem]">
      <label className="field-label" htmlFor="admin-api-key">
        {t('ops.key.label')}
      </label>

      <div className="flex gap-2">
        <div
          className={[
            'control flex flex-1 items-center gap-2.5 px-3.5',
            'h-12 sm:h-11',
            invalid ? 'border-danger' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <input
            id="admin-api-key"
            ref={inputRef}
            type={revealed ? 'text' : 'password'}
            className="text-muted min-w-0 flex-1 bg-transparent font-mono text-sm tracking-[0.2em] outline-none"
            // A key is pasted, not remembered: nothing here asks a password
            // manager to keep it, and nothing corrects its spelling.
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={invalid}
            placeholder={t('ops.key.placeholder')}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          <button
            type="button"
            className="text-faint hover:text-ink shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] uppercase"
            aria-pressed={revealed}
            onClick={() => {
              setRevealed((shown) => !shown);
            }}
          >
            {revealed ? t('ops.key.hide') : t('ops.key.reveal')}
          </button>
          <span
            className="text-faint shrink-0 font-mono text-[0.6875rem] uppercase"
            aria-hidden="true"
          >
            {t('ops.key.header')}
          </span>
        </div>

        <button
          type="button"
          className="button button-outline h-12 shrink-0 px-4 text-sm sm:h-11"
          disabled={value === ''}
          onClick={() => {
            onChange('');
            setRevealed(false);
          }}
        >
          {t('ops.key.forget')}
        </button>
      </div>

      <p className="text-faint text-xs">{t('ops.key.hint')}</p>
    </div>
  );
}
