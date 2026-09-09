import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { WarningIcon } from '../../../components';
import type { AmountSeparators } from '../../../lib';
import { formatAmountInput } from '../lib/amount/formatAmountInput';

interface AmountFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  error: string | null;
  separators: AmountSeparators;
  /** A conversion is in flight: the field steps back and its hint stands down (board 1g). */
  isSubmitting: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}

/**
 * The amount, grouped as it is typed. Every edit — a keystroke, a paste, a
 * drop — goes through `formatAmountInput`, so the field can only ever hold
 * something an amount could be, and the caret stays where the user left it
 * rather than jumping to the end when a separator appears in front of it.
 *
 * While a conversion is on its way the field dims and drops its hint, so the
 * pane the answer is landing in is the only thing on the card still speaking.
 */
export function AmountField({
  id,
  label,
  hint,
  value,
  error,
  separators,
  isSubmitting,
  inputRef,
  onChange,
}: AmountFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const caret = useCaret(inputRef, value);
  // A hint that is not on the page is not a description of anything.
  const describedBy = [isSubmitting ? null : hintId, error === null ? null : errorId]
    .filter((id): id is string => id !== null)
    .join(' ');

  function apply(raw: string, at: number): void {
    const next = formatAmountInput(raw, at, separators);
    caret.moveTo(next.caret);
    onChange(next.value);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    apply(event.target.value, event.target.selectionStart ?? event.target.value.length);
  }

  /**
   * A separator is not the user's character to delete: removing it alone would
   * be undone by the regrouping, so the key would look broken. Both keys take
   * the digit on their side of it instead.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const start = input.selectionStart;

    if (separators.group === '' || start === null || start !== input.selectionEnd) {
      return;
    }

    if (event.key === 'Backspace' && input.value.charAt(start - 1) === separators.group) {
      event.preventDefault();
      apply(input.value.slice(0, start - 2) + input.value.slice(start), start - 2);
      return;
    }

    if (event.key === 'Delete' && input.value.charAt(start) === separators.group) {
      event.preventDefault();
      apply(input.value.slice(0, start) + input.value.slice(start + 2), start);
    }
  }

  /** `12.` is what a half-typed decimal looks like; it is not what was meant. */
  function handleBlur() {
    if (value.endsWith(separators.decimal)) {
      onChange(value.slice(0, -separators.decimal.length));
    }
  }

  return (
    <div className={['grid gap-2', isSubmitting ? 'opacity-60' : ''].join(' ').trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        name="amount"
        type="text"
        className="control control-amount"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        value={value}
        aria-invalid={error !== null}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {!isSubmitting && (
        <p id={hintId} className="text-faint numeric text-xs">
          {hint}
        </p>
      )}
      {error !== null && (
        <p id={errorId} role="alert" className="text-danger flex items-start gap-1.5 text-sm">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

interface Caret {
  moveTo: (position: number) => void;
}

/**
 * Puts the caret back after a reformat, and re-asserts the value the field is
 * allowed to hold. The second half is why this runs after every render rather
 * than on a change of `value`: a rejected character leaves the state unchanged,
 * so React re-renders nothing and the DOM would keep the character it was
 * typed with.
 */
function useCaret(inputRef: RefObject<HTMLInputElement | null>, value: string): Caret {
  const pending = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }

    if (input.value !== value) {
      input.value = value;
    }

    const position = pending.current;
    pending.current = null;

    if (position !== null) {
      input.setSelectionRange(position, position);
    }
  });

  return {
    moveTo(position) {
      pending.current = position;
    },
  };
}
