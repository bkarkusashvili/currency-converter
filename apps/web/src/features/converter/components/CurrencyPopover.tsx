import type { CSSProperties, KeyboardEvent, Ref, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { CurrencyListbox, type CurrencyListboxProps } from './CurrencyListbox';
import { SearchIcon } from './SearchIcon';

interface CurrencyPopoverProps extends CurrencyListboxProps {
  searchId: string;
  /** Read back by the combobox to place the popover against the window it has to fit in. */
  popoverRef: RefObject<HTMLDivElement | null>;
  /** Fixed coordinates measured off the trigger, so the card's `overflow:hidden` cannot clip it. */
  position: CSSProperties;
  total: number;
  inputRef: Ref<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * The list as it opens on a wide viewport (§3.7): 320px under the trigger,
 * five rows before it scrolls, and a footer that says how much of the list is
 * showing and how to work it from the keyboard.
 */
export function CurrencyPopover({
  searchId,
  popoverRef,
  position,
  total,
  inputRef,
  onQueryChange,
  onKeyDown,
  ...list
}: CurrencyPopoverProps) {
  const { t } = useTranslation();
  const { matches, query, listboxId, labelledBy, activeIndex, optionId } = list;
  const filtered = query.trim() !== '';

  return (
    <div ref={popoverRef} className="overlay-surface combobox-popover" style={position}>
      <div className="combobox-search">
        <SearchIcon className="text-faint h-[0.9375rem] w-[0.9375rem]" />
        <input
          id={searchId}
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-labelledby={labelledBy}
          aria-controls={listboxId}
          aria-activedescendant={matches.length === 0 ? undefined : optionId(activeIndex)}
          placeholder={t('converter.form.searchPlaceholder')}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="key-hint" aria-hidden="true">
          {t('converter.form.dismissKey')}
        </span>
      </div>

      <CurrencyListbox {...list} />

      <div className="combobox-meta">
        <span>
          {filtered
            ? t('converter.form.currencyCountFiltered', { shown: matches.length, total })
            : t('converter.form.currencyCount', { count: total })}
        </span>
        <span aria-hidden="true">{t('converter.form.keyboardHint')}</span>
      </div>
    </div>
  );
}
