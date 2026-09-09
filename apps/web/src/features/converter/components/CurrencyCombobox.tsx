import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '../../../components';
import { useIsCompact } from '../../../lib';
import { useComboboxState } from '../hooks/useComboboxState';
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

/**
 * A currency picker with a search field: the popover of board `1c` on a wide
 * viewport and the bottom sheet of board `1j` below 640px, which are two
 * surfaces around one keyboard model — `useComboboxState` — and one set of
 * rows.
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

  const labelId = `${id}-label`;
  const listboxId = `${id}-listbox`;
  const searchId = `${id}-search`;
  const titleId = `${id}-sheet-title`;
  const errorId = `${id}-error`;

  const optionId = useCallback((index: number) => `${id}-option-${String(index)}`, [id]);
  const picker = useComboboxState({ currencies, value, compact, listboxId, optionId, onChange });
  const selected = currencies.find((currency) => currency.code === value);

  const listProps = {
    listboxId,
    labelledBy: labelId,
    optionId,
    matches: picker.matches,
    activeIndex: picker.activeIndex,
    value,
    otherValue,
    query: picker.query,
    onSelect: picker.select,
    onHover: (index: number) => {
      picker.changeActiveIndex(index);
    },
  };

  return (
    // `min-w-0` twice: a grid item's automatic minimum is its content, and the
    // trigger's content is a name of any length. Without it the pane grows to
    // fit the longest currency name and the amount field grows with it, which
    // is the shrink-to-fit trigger again by another route.
    <div className="grid min-w-0 gap-3.5">
      <span className="field-label" id={labelId}>
        {label}
      </span>

      <div className="relative min-w-0">
        <CurrencyTrigger
          id={id}
          labelId={labelId}
          listboxId={listboxId}
          code={value}
          name={selected === undefined ? undefined : optionName(selected)}
          open={picker.open}
          isLoading={isLoading}
          disabled={disabled}
          invalid={error !== null}
          describedBy={error === null ? undefined : errorId}
          triggerRef={picker.triggerRef}
          onOpen={picker.openWith}
          onToggle={() => {
            if (picker.open) {
              picker.close();
            } else {
              picker.openWith('');
            }
          }}
        />

        {isLoading && (
          <span role="status" className="sr-only">
            {t('converter.form.currenciesLoading', { field: label })}
          </span>
        )}

        {picker.open &&
          (compact ? (
            <CurrencySheet
              {...listProps}
              searchId={searchId}
              titleId={titleId}
              title={sheetTitle}
              total={currencies.length}
              inputRef={picker.inputRef}
              onQueryChange={picker.changeQuery}
              onKeyDown={picker.onKeyDown}
              onDismiss={() => {
                picker.close();
              }}
            />
          ) : (
            <CurrencyPopover
              {...listProps}
              searchId={searchId}
              popoverRef={picker.popoverRef}
              position={picker.position}
              total={currencies.length}
              inputRef={picker.inputRef}
              onQueryChange={picker.changeQuery}
              onKeyDown={picker.onKeyDown}
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
