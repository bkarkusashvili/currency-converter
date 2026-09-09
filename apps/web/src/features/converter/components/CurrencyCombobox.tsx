import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '../../../components';
import { useIsCompact } from '../../../lib';
import { filterCurrencies } from '../lib/currencyFilter';
import { optionName, type CurrencyOption } from '../lib/currencyOptions';
import { CurrencyPopover } from './CurrencyPopover';
import { CurrencySheet } from './CurrencySheet';
import { CurrencyTrigger } from './CurrencyTrigger';

interface CurrencyComboboxProps {
  id: string;
  /** `From` / `To` — the pane eyebrow, which labels the control (§3.7). */
  label: string;
  /** `From currency` / `To currency`, the title the bottom sheet carries. */
  sheetTitle: string;
  value: string;
  currencies: readonly CurrencyOption[];
  /** The currency the other pane holds, so this list can dim it. */
  otherValue: string;
  /** The list is still on its way; the trigger says so and cannot be opened. */
  isLoading: boolean;
  /** A conversion is in flight, so the form is not taking changes. */
  disabled?: boolean;
  error: string | null;
  onChange: (code: string) => void;
}

/** Below the trigger, with the 6px of air the boards leave between them. */
const POPOVER_GAP = 6;

/**
 * A currency picker with a search field: the popover of board `1c` on a wide
 * viewport and the bottom sheet of board `1j` below 640px, which are two
 * surfaces around one keyboard model.
 *
 * The trigger is the combobox and the search field is where typing lands, so
 * `aria-activedescendant` travels with focus onto the field while the list is
 * open. Escape closes and hands focus back to the trigger, which is also where
 * it lands after a row is picked with the mouse.
 */
export function CurrencyCombobox({
  id,
  label,
  sheetTitle,
  value,
  currencies,
  otherValue,
  isLoading,
  disabled = false,
  error,
  onChange,
}: CurrencyComboboxProps) {
  const { t } = useTranslation();
  const compact = useIsCompact();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});

  const labelId = `${id}-label`;
  const listboxId = `${id}-listbox`;
  const searchId = `${id}-search`;
  const titleId = `${id}-sheet-title`;
  const errorId = `${id}-error`;

  const matches = useMemo(() => filterCurrencies(currencies, query), [currencies, query]);
  const selected = currencies.find((currency) => currency.code === value);
  const optionId = useCallback((index: number) => `${id}-option-${String(index)}`, [id]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  function openWith(seed: string) {
    const rows = filterCurrencies(currencies, seed);
    const current = rows.findIndex((match) => match.option.code === value);
    setQuery(seed);
    setActiveIndex(current === -1 ? 0 : current);
    setOpen(true);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setActiveIndex(0);
  }

  function select(code: string) {
    onChange(code);
    close();
  }

  function move(delta: number) {
    if (matches.length === 0) {
      return;
    }
    setActiveIndex((index) => (index + delta + matches.length) % matches.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(matches.length - 1, 0));
        break;
      case 'Enter': {
        // Always swallowed: the picker lives inside the converter's form, and
        // Enter meaning "submit" while a list is open would convert whatever
        // the row under the caret was about to change.
        event.preventDefault();
        const match = matches[activeIndex];
        if (match !== undefined) {
          select(match.option.code);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        // The popover is not modal: Tab leaves it, the way it leaves any
        // control. The sheet is, and its trap keeps Tab inside instead.
        if (!compact) {
          close(false);
        }
        break;
      default:
        break;
    }
  }

  // Measured rather than positioned by the flow: the converter card clips its
  // own overflow, so the popover is fixed to coordinates read off the trigger.
  useLayoutEffect(() => {
    if (!open || compact) {
      return;
    }

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect === undefined) {
        return;
      }
      setPosition({ top: rect.bottom + POPOVER_GAP, left: rect.left });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Keeps the active row in view when the list is longer than the five rows
  // the popover shows. jsdom has no layout and no `scrollIntoView`.
  useEffect(() => {
    if (!open) {
      return;
    }
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, optionId]);

  // A click anywhere else is a dismissal, and the trigger's own click would
  // otherwise close and reopen in one gesture.
  useEffect(() => {
    if (!open || compact) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        triggerRef.current?.contains(target) !== true &&
        document.getElementById(listboxId)?.closest('.combobox-popover')?.contains(target) !== true
      ) {
        close(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, compact, close, listboxId]);

  const listProps = {
    listboxId,
    labelledBy: labelId,
    optionId,
    matches,
    activeIndex,
    value,
    otherValue,
    query,
    onSelect: select,
    onHover: setActiveIndex,
  };

  return (
    <div className="grid gap-3.5">
      <span className="field-label" id={labelId}>
        {label}
      </span>

      <div className="relative">
        <CurrencyTrigger
          id={id}
          labelId={labelId}
          listboxId={listboxId}
          code={value}
          name={selected === undefined ? undefined : optionName(selected)}
          open={open}
          isLoading={isLoading}
          disabled={disabled}
          invalid={error !== null}
          describedBy={error === null ? undefined : errorId}
          triggerRef={triggerRef}
          onOpen={openWith}
          onToggle={() => {
            if (open) {
              close();
            } else {
              openWith('');
            }
          }}
        />

        {isLoading && (
          <span role="status" className="sr-only">
            {t('converter.form.currenciesLoading', { field: label })}
          </span>
        )}

        {open &&
          (compact ? (
            <CurrencySheet
              {...listProps}
              searchId={searchId}
              titleId={titleId}
              title={sheetTitle}
              total={currencies.length}
              inputRef={inputRef}
              onQueryChange={changeQuery}
              onKeyDown={handleKeyDown}
              onDismiss={() => {
                close();
              }}
            />
          ) : (
            <CurrencyPopover
              {...listProps}
              searchId={searchId}
              position={position}
              total={currencies.length}
              inputRef={inputRef}
              onQueryChange={changeQuery}
              onKeyDown={handleKeyDown}
            />
          ))}
      </div>

      {error !== null && (
        <p id={errorId} role="alert" className="text-danger flex items-start gap-1.5 text-sm">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
