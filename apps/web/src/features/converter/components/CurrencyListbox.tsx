import { useTranslation } from 'react-i18next';
import type { CurrencyMatch } from '../lib/currencyFilter';
import { MarkedText } from './MarkedText';

export interface CurrencyListboxProps {
  listboxId: string;
  /** The pane eyebrow — `From` / `To` — which names the list as well as the trigger. */
  labelledBy: string;
  optionId: (index: number) => string;
  matches: readonly CurrencyMatch[];
  /** The row the keyboard is on; `aria-activedescendant` points at it. */
  activeIndex: number;
  /** This pane's currency. */
  value: string;
  /** The other pane's, dimmed but pickable — identity is a valid strategy. */
  otherValue: string;
  query: string;
  onSelect: (code: string) => void;
  onHover: (index: number) => void;
}

/**
 * The rows, shared by the popover and the bottom sheet: the two surfaces differ
 * in size and in where they sit, not in what a row is or how it is announced.
 */
export function CurrencyListbox({
  listboxId,
  labelledBy,
  optionId,
  matches,
  activeIndex,
  value,
  otherValue,
  query,
  onSelect,
  onHover,
}: CurrencyListboxProps) {
  const { t } = useTranslation();

  return (
    <>
      {matches.length === 0 && (
        <p className="text-muted px-3.5 py-6 text-sm text-pretty">
          {t('converter.form.noMatch', { query })}
        </p>
      )}

      {/* Rendered even with nothing in it: it is what the search field's
          `aria-controls` names, and a listbox that disappears mid-search is a
          reference that dangles. */}
      <ul
        className="combobox-list"
        role="listbox"
        id={listboxId}
        aria-labelledby={labelledBy}
        data-empty={matches.length === 0}
      >
        {matches.map((match, index) => {
          const { code } = match.option;

          return (
            <li
              key={code}
              id={optionId(index)}
              role="option"
              aria-selected={code === value}
              // The visible text, spelled with the space the two spans do not
              // have between them, so a reader hears "EUR Euro" and not
              // "EUREuro".
              aria-label={match.name === undefined ? code : `${code} ${match.name}`}
              data-active={index === activeIndex}
              data-other={code !== value && code === otherValue}
              className="combobox-option"
              // The list is driven from the search field's keyboard, so a row is
              // pointed at rather than focused: mousedown is swallowed before
              // the field can lose focus, and the click that follows selects.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onMouseMove={() => {
                onHover(index);
              }}
              onClick={() => {
                onSelect(code);
              }}
            >
              <span className="combobox-option-code">
                <MarkedText text={code} match={match.codeMatch} />
              </span>
              {match.name !== undefined && (
                <span className="combobox-option-name">
                  <MarkedText text={match.name} match={match.nameMatch} />
                </span>
              )}
              {code === value && (
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                  className="text-accent h-3.5 w-3.5 shrink-0"
                >
                  <path
                    d="m3 8.5 3 3 7-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
