import type { AmountSeparators } from './formatAmountInput';

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
