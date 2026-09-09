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
  const empty = value === '';

  return (
    <div className="grid gap-2 sm:min-w-[22.5rem]">
      <label className="field-label" htmlFor="admin-api-key">
        {t('ops.key.label')}
      </label>

      <div className="flex gap-2">
        <div
          className={[
            'control flex h-12 flex-1 items-center gap-1 pr-1 pl-3.5 sm:h-11',
            invalid ? 'border-danger' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <input
            id="admin-api-key"
            ref={inputRef}
            type={revealed ? 'text' : 'password'}
            // Wide letter-spacing reads as a key; on the placeholder it reads
            // as a sentence pulled apart, so the field only wears it once it
            // has something to space out.
            className={[
              'text-muted min-w-0 flex-1 self-stretch bg-transparent outline-none',
              empty ? 'text-[0.9375rem]' : 'font-mono text-sm tracking-[0.2em]',
            ].join(' ')}
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
            className="text-faint hover:text-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
            aria-label={revealed ? t('ops.key.hide') : t('ops.key.reveal')}
            aria-pressed={revealed}
            disabled={empty}
            onClick={() => {
              setRevealed((shown) => !shown);
            }}
          >
            <EyeIcon crossed={revealed} />
          </button>

          {/* The header the key travels in, said once on a wide viewport where
              there is room for it. */}
          <span
            className="text-faint hidden shrink-0 pr-2 font-mono text-[0.6875rem] uppercase sm:inline"
            aria-hidden="true"
          >
            {t('ops.key.header')}
          </span>
        </div>

        {/* Nothing to forget until there is something to forget. */}
        {!empty && (
          <button
            type="button"
            className="button button-outline h-12 shrink-0 px-4 text-sm sm:h-11"
            onClick={() => {
              onChange('');
              setRevealed(false);
            }}
          >
            {t('ops.key.forget')}
          </button>
        )}
      </div>

      <p className="text-faint text-xs">{t('ops.key.hint')}</p>
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="h-4 w-4">
      <path
        d="M1.75 10S4.5 5 10 5s8.25 5 8.25 5-2.75 5-8.25 5-8.25-5-8.25-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {crossed && (
        <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}
