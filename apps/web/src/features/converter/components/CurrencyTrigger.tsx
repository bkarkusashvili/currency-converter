import type { KeyboardEvent, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../components';

interface CurrencyTriggerProps {
  id: string;
  labelId: string;
  listboxId: string;
  code: string;
  /** The currency's name, or nothing when the code is all the API gave. */
  name: string | undefined;
  open: boolean;
  /** The list has not arrived, so there is nothing to open yet. */
  isLoading: boolean;
  /** A conversion is in flight; the form is not taking changes. */
  disabled: boolean;
  invalid: boolean;
  describedBy: string | undefined;
  triggerRef: Ref<HTMLButtonElement>;
  onOpen: (seed: string) => void;
  onToggle: () => void;
}

/**
 * The closed control: a code chip, the currency's name, and the chevron that
 * turns over while the list is open. Its accessible name is the pane's eyebrow
 * followed by the value — "From, USD US Dollar" — which is why the eyebrow is
 * the label and no second `<label>` is drawn.
 */
export function CurrencyTrigger({
  id,
  labelId,
  listboxId,
  code,
  name,
  open,
  isLoading,
  disabled,
  invalid,
  describedBy,
  triggerRef,
  onOpen,
  onToggle,
}: CurrencyTriggerProps) {
  const { t } = useTranslation();
  const codeId = `${id}-code`;
  const nameId = `${id}-name`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      onOpen('');
      return;
    }

    // Typing on a closed picker opens it with what was typed already in the
    // search field, so the first keystroke is not the one that gets lost.
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onOpen(event.key);
    }
  }

  return (
    <button
      type="button"
      id={id}
      ref={triggerRef}
      role="combobox"
      className={[
        'combobox-trigger',
        isLoading ? 'opacity-[0.55]' : '',
        disabled && !isLoading ? 'opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-expanded={open}
      aria-controls={listboxId}
      aria-haspopup="listbox"
      aria-labelledby={`${labelId} ${codeId} ${nameId}`}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      disabled={disabled || isLoading}
      onKeyDown={handleKeyDown}
      onClick={onToggle}
    >
      <span className="combobox-code" id={codeId}>
        {code}
      </span>
      <span className="combobox-name" id={nameId}>
        {isLoading ? t('converter.form.listLoading') : (name ?? code)}
      </span>
      {/* The spinner stands in the chevron's box and is its size, so the row is
          the same width whether the list is on its way or already here. While
          the form is not taking changes the glyph goes fainter and stays: a
          chevron taken away and put back is the trigger changing width under
          the pointer on every press. */}
      {isLoading ? (
        <Spinner className="text-muted combobox-chevron shrink-0" />
      ) : (
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          focusable="false"
          className={[
            'combobox-chevron shrink-0 transition-transform',
            disabled ? 'text-faint' : 'text-muted',
            open ? 'rotate-180' : '',
          ]
            .filter(Boolean)
            .join(' ')}
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
    </button>
  );
}
