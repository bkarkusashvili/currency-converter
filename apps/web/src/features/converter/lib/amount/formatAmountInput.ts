import { MAX_AMOUNT } from './parseAmount';

export interface AmountSeparators {
  /** The thousands separator of the active locale; `''` for a locale that does not group. */
  group: string;
  decimal: string;
}

/** What `en` uses, and what the helper falls back to when no locale is passed. */
export const DEFAULT_SEPARATORS: AmountSeparators = { group: ',', decimal: '.' };

/** Money is quoted to two places, and §3 rounds a result to the same one. */
export const MAX_FRACTION_DIGITS = 2;

/**
 * The width of the API's cap, so the field cannot hold a number longer than
 * `1_000_000_000_000`. It is a width and not the value: `parseAmount` stays the
 * one rule for what an amount *means*, and it is what names `9,999,999,999,999`
 * as too large. Filtering here only keeps the field from accepting characters
 * no amount can contain.
 */
export const MAX_INTEGER_DIGITS = String(MAX_AMOUNT).length;

export interface FormattedAmountInput {
  /** What the field shows: digits, one decimal separator, grouped thousands. */
  value: string;
  /** Where the caret belongs in that value. */
  caret: number;
}

/**
 * The amount field, reformatted after every edit, with the caret kept where the
 * user left it.
 *
 * Everything that is not a digit or the locale's decimal separator is dropped —
 * letters, signs, spaces, a second separator, a third decimal — so a keystroke
 * or a paste that cannot be part of an amount never lands in the field. The
 * caret is then placed after the same number of *significant* characters
 * (digits and the decimal separator) it had passed before the edit, which is
 * what keeps typing inside a grouped number from throwing the caret to the end
 * when a separator appears or disappears in front of it.
 */
export function formatAmountInput(
  raw: string,
  caret: number,
  separators: AmountSeparators = DEFAULT_SEPARATORS,
): FormattedAmountInput {
  const position = Math.min(Math.max(caret, 0), raw.length);

  let integer = '';
  let fraction = '';
  let hasDecimal = false;
  /** Kept characters that came from before the caret; the caret follows them. */
  let keptBefore = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw.charAt(index);
    const before = index < position;

    if (char === separators.decimal) {
      if (hasDecimal) {
        continue;
      }
      hasDecimal = true;
    } else if (!isDigit(char)) {
      continue;
    } else if (hasDecimal) {
      if (fraction.length >= MAX_FRACTION_DIGITS) {
        continue;
      }
      fraction += char;
    } else {
      if (integer.length >= MAX_INTEGER_DIGITS) {
        continue;
      }
      integer += char;
    }

    if (before) {
      keptBefore += 1;
    }
  }

  // Leading zeros are the first characters kept, so the caret loses exactly the
  // ones it had already passed.
  const significant = integer.replace(/^0+(?=\d)/, '');
  keptBefore -= Math.min(integer.length - significant.length, keptBefore);
  integer = significant;

  if (integer === '' && !hasDecimal) {
    return { value: '', caret: 0 };
  }

  if (integer === '') {
    // A leading separator is completed rather than rejected, so `.5` is 0.5;
    // the caret moves past the zero unless it was in front of everything.
    integer = '0';
    keptBefore += keptBefore > 0 ? 1 : 0;
  }

  const grouped = group(integer, separators.group);
  const value = hasDecimal ? `${grouped}${separators.decimal}${fraction}` : grouped;

  return { value, caret: caretAfter(value, keptBefore, separators.group) };
}

function caretAfter(value: string, significant: number, groupSeparator: string): number {
  let seen = 0;
  let index = 0;

  while (index < value.length && seen < significant) {
    if (value.charAt(index) !== groupSeparator) {
      seen += 1;
    }
    index += 1;
  }

  return index;
}

function group(digits: string, separator: string): string {
  if (separator === '') {
    return digits;
  }

  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }

  return groups.join(separator);
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

/**
 * What the field holds, rewritten as the number it stands for.
 *
 * `formatAmountInput` writes the value in the active locale — thousands grouped
 * with that locale's mark, the fraction behind its decimal mark — and
 * `parseAmount` reads a *user-typed* string, where the same characters can mean
 * either thing. Under `{group: '.', decimal: ','}` the field's own `1.234` for
 * 1234 reads back as 1.234, and a half-typed `12.` reads back as nothing at
 * all. Between the two there has to be one step that says which mark was which,
 * and this is it: the group mark is dropped, the decimal mark becomes `.`, and
 * a decimal mark with no digits behind it goes with it.
 *
 * It converts a value the field produced. What an amount *means* — the bounds,
 * and every string a person could type into some other field — is still
 * `parseAmount`'s rule alone.
 */
export function canonicalAmount(value: string, separators: AmountSeparators): string {
  const ungrouped = separators.group === '' ? value : splitJoin(value, separators.group, '');
  const normalised = splitJoin(ungrouped, separators.decimal, '.');

  return normalised.endsWith('.') ? normalised.slice(0, -1) : normalised;
}

function splitJoin(text: string, separator: string, replacement: string): string {
  return separator === replacement ? text : text.split(separator).join(replacement);
}
