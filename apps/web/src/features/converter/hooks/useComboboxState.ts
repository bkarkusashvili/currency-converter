import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { filterCurrencies, type CurrencyMatch } from '../lib/currencyFilter';
import type { CurrencyOption } from '../lib/currencyOptions';
import { placePopover } from '../lib/popoverPlacement';

interface ComboboxStateOptions {
  currencies: readonly CurrencyOption[];
  /** The currency this pane holds, which is the row the list opens on. */
  value: string;
  /** Below 640 the list is a modal sheet, which changes what Tab and a click outside mean. */
  compact: boolean;
  /** The listbox's id, so a click inside the popover can be told from one outside it. */
  listboxId: string;
  optionId: (index: number) => string;
  onChange: (code: string) => void;
}

interface ComboboxState {
  open: boolean;
  query: string;
  activeIndex: number;
  matches: readonly CurrencyMatch[];
  /** Fixed coordinates for the popover, measured off the trigger and its own box. */
  position: CSSProperties;
  triggerRef: RefObject<HTMLButtonElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Opens with `seed` already in the search field, which is what typing on a closed trigger does. */
  openWith: (seed: string) => void;
  close: (restoreFocus?: boolean) => void;
  changeQuery: (next: string) => void;
  /** Points the keyboard at a row the pointer moved over. */
  changeActiveIndex: (index: number) => void;
  select: (code: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Everything the picker does that is not drawing: what is open, what has been
 * typed, which row the keyboard is on, where the popover goes, and the four
 * listeners that keep those true while it is open.
 *
 * It lives beside the component rather than inside it because the two surfaces
 * — popover and sheet — share one model, and a component that renders both was
 * carrying the model as well.
 */
export function useComboboxState({
  currencies,
  value,
  compact,
  listboxId,
  optionId,
  onChange,
}: ComboboxStateOptions): ComboboxState {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});

  const matches = useMemo(() => filterCurrencies(currencies, query), [currencies, query]);

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

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
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
      case 'Tab':
        // The popover is not modal: Tab leaves it, the way it leaves any
        // control. Focus goes back to the trigger first, so the browser's own
        // Tab carries on from there — closing without it left the caret on a
        // node being unmounted, and the next Tab started again at `<body>`.
        // The sheet is modal, and its trap keeps Tab inside instead.
        if (!compact) {
          close();
        }
        break;
      default:
        break;
    }
  }

  // Measured rather than positioned by the flow: the converter card clips its
  // own overflow, so the popover is fixed to coordinates read off the trigger
  // and off its own size — which is what `placePopover` needs to know whether
  // it still fits under the trigger. Re-measured while the list is open,
  // because scrolling the page and filtering the list both move it.
  useLayoutEffect(() => {
    if (!open || compact) {
      return;
    }

    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = popoverRef.current?.getBoundingClientRect();
      if (trigger === undefined || panel === undefined) {
        return;
      }

      const { top, left } = placePopover(trigger, panel, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setPosition({ top, left });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, compact, matches.length]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Escape belongs to the surface, not to the search field. In the sheet the
  // Cancel button and the clear button are both Tab stops, and Escape from
  // either of them was reaching nothing at all.
  useEffect(() => {
    if (!open) {
      return;
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    }

    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, close]);

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

  return {
    open,
    query,
    activeIndex,
    matches,
    position,
    triggerRef,
    popoverRef,
    inputRef,
    openWith,
    close,
    changeQuery,
    changeActiveIndex: setActiveIndex,
    select,
    onKeyDown,
  };
}
