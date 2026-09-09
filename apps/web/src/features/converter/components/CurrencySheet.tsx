import { useRef, type KeyboardEvent, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../../lib';
import { CurrencyListbox, type CurrencyListboxProps } from './CurrencyListbox';
import { SearchIcon } from './SearchIcon';

interface CurrencySheetProps extends CurrencyListboxProps {
  searchId: string;
  titleId: string;
  /** `From currency` / `To currency` — the sheet covers the pane that said which. */
  title: string;
  total: number;
  inputRef: Ref<HTMLInputElement>;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onDismiss: () => void;
}

/**
 * The same list under 640px (§3.7, board `1j`): a modal sheet over a scrim,
 * with the search field at the top where a thumb and an on-screen keyboard
 * both reach it, and rows at 52px instead of 44.
 */
export function CurrencySheet({
  searchId,
  titleId,
  title,
  total,
  inputRef,
  onQueryChange,
  onKeyDown,
  onDismiss,
  ...list
}: CurrencySheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const { matches, query, listboxId, labelledBy, activeIndex, optionId } = list;
  const filtered = query.trim() !== '';

  useFocusTrap(sheetRef, true);

  return (
    <>
      <div
        className="scrim"
        // The scrim is a second way out of a modal surface, and Cancel is the
        // first: nothing here is announced twice.
        aria-hidden="true"
        onClick={onDismiss}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="overlay-surface sheet"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="sheet-grabber" aria-hidden="true" />
        </div>

        <div className="grid gap-3 px-4 pt-2 pb-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className="text-base">
              {title}
            </h2>
            <button type="button" className="button-flat" onClick={onDismiss}>
              {t('common.cancel')}
            </button>
          </div>

          <div className="control-search">
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
            {query !== '' && (
              <button
                type="button"
                className="bg-sunken text-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
                aria-label={t('converter.form.clearSearch')}
                onClick={() => {
                  onQueryChange('');
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto">
          <CurrencyListbox {...list} />
        </div>

        <div className="combobox-meta">
          <span>
            {filtered
              ? t('converter.form.currencyCountFiltered', { shown: matches.length, total })
              : t('converter.form.currencyCount', { count: total })}
          </span>
          <span aria-hidden="true">{t('converter.form.sheetHint')}</span>
        </div>
      </div>
    </>
  );
}
