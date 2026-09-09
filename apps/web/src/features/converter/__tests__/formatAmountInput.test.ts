import { describe, expect, it } from 'vitest';
import type { AmountSeparators } from '../../../lib';
import {
  canonicalAmount,
  DEFAULT_SEPARATORS,
  formatAmountInput,
  MAX_INTEGER_DIGITS,
} from '../lib/amount/formatAmountInput';
import { MAX_AMOUNT, parseAmount } from '../lib/amount/parseAmount';

/** What a German or French keyboard hands the field. */
const SWAPPED: AmountSeparators = { group: '.', decimal: ',' };

describe('typing', () => {
  it('groups thousands as soon as there are four digits', () => {
    expect(formatAmountInput('1234', 4)).toEqual({ value: '1,234', caret: 5 });
    expect(formatAmountInput('1234567', 7)).toEqual({ value: '1,234,567', caret: 9 });
  });

  it('keeps the caret after the digit that was just typed, not at the end', () => {
    // "1|234567" — a separator appears in front of the caret and must not drag it along.
    expect(formatAmountInput('1234567', 1)).toEqual({ value: '1,234,567', caret: 1 });
    expect(formatAmountInput('1234567', 4)).toEqual({ value: '1,234,567', caret: 5 });
  });

  it('keeps a decimal separator that has no digits after it yet', () => {
    expect(formatAmountInput('12.', 3)).toEqual({ value: '12.', caret: 3 });
  });

  it('completes a leading separator instead of rejecting it', () => {
    expect(formatAmountInput('.5', 2)).toEqual({ value: '0.5', caret: 3 });
    expect(formatAmountInput('.', 1)).toEqual({ value: '0.', caret: 2 });
  });

  it('leaves an empty field empty', () => {
    expect(formatAmountInput('', 0)).toEqual({ value: '', caret: 0 });
  });
});

describe('filtering', () => {
  it('drops everything an amount cannot contain', () => {
    expect(formatAmountInput('abc12', 5).value).toBe('12');
    expect(formatAmountInput('-12', 3).value).toBe('12');
    expect(formatAmountInput('1e5', 3).value).toBe('15');
    expect(formatAmountInput('12 34', 5).value).toBe('1,234');
    expect(formatAmountInput('$12', 3).value).toBe('12');
  });

  it('keeps only the first decimal separator', () => {
    expect(formatAmountInput('1.2.3', 5)).toEqual({ value: '1.23', caret: 4 });
  });

  it('stops at two decimals', () => {
    expect(formatAmountInput('1.2345', 6)).toEqual({ value: '1.23', caret: 4 });
  });

  it('caps the integer part at the width of the API maximum', () => {
    const capped = formatAmountInput('9'.repeat(MAX_INTEGER_DIGITS + 4), 17);

    expect(capped.value).toBe('9,999,999,999,999');
    expect(capped.value.replace(/,/g, '')).toHaveLength(MAX_INTEGER_DIGITS);
    // The width is the cap the field enforces; what the value means is still parseAmount's rule.
    expect(parseAmount(capped.value)).toEqual({ ok: false, error: 'tooLarge' });
    expect(parseAmount(String(MAX_AMOUNT))).toEqual({ ok: true, value: MAX_AMOUNT });
  });
});

describe('leading zeros', () => {
  it('collapses them, and moves the caret past the ones it removed', () => {
    expect(formatAmountInput('007', 3)).toEqual({ value: '7', caret: 1 });
    expect(formatAmountInput('01', 2)).toEqual({ value: '1', caret: 1 });
    expect(formatAmountInput('00.5', 4)).toEqual({ value: '0.5', caret: 3 });
  });

  it('keeps a lone zero, which is what someone is typing before a decimal', () => {
    expect(formatAmountInput('0', 1)).toEqual({ value: '0', caret: 1 });
  });
});

describe('deleting a separator', () => {
  it('regroups and leaves the caret where the separator was', () => {
    // "1,|234" backspaced to "1|234": the separator comes straight back.
    expect(formatAmountInput('1234', 1)).toEqual({ value: '1,234', caret: 1 });
  });

  it('regroups after a digit next to a separator goes', () => {
    // "1,2|34" backspaced to "1,|34"
    expect(formatAmountInput('1,34', 2)).toEqual({ value: '134', caret: 1 });
  });
});

describe('pasting', () => {
  it('takes the number out of what was pasted', () => {
    expect(formatAmountInput('$1,234,567.899', 14)).toEqual({
      value: '1,234,567.89',
      caret: 12,
    });
  });

  it('places the caret at the end of a paste into an empty field', () => {
    expect(formatAmountInput('1234567.5', 9)).toEqual({ value: '1,234,567.5', caret: 11 });
  });
});

describe('locale separators', () => {
  it('groups and marks decimals the way the locale does', () => {
    expect(formatAmountInput('1234567,89', 10, SWAPPED)).toEqual({
      value: '1.234.567,89',
      caret: 12,
    });
  });

  it('treats the locale grouping mark as grouping, not as a decimal', () => {
    expect(formatAmountInput('1.234', 5, SWAPPED)).toEqual({ value: '1.234', caret: 5 });
  });

  it('groups nothing for a locale that does not group', () => {
    expect(formatAmountInput('1234567', 7, { group: '', decimal: '.' })).toEqual({
      value: '1234567',
      caret: 7,
    });
  });
});

/**
 * The whole round trip, in both a locale that groups with `,` and one that
 * groups with `.`: what the field writes, canonicalised, is what the form
 * submits. Under the swapped separators the field's own output collides with
 * `parseAmount`'s reading of a typed string — `1.234` is 1234 here and 1.234
 * there — which is what `canonicalAmount` stands between.
 */
describe.each([
  ['the locale separators', DEFAULT_SEPARATORS],
  ['separators the other way round', SWAPPED],
])('what the form then parses under %s', (_name, separators) => {
  function submitted(typed: string) {
    const { value } = formatAmountInput(typed, typed.length, separators);
    return parseAmount(canonicalAmount(value, separators));
  }

  const decimal = separators.decimal;

  it('reads back the number that was typed', () => {
    expect(submitted(`1234567${decimal}89`)).toEqual({ ok: true, value: 1234567.89 });
    expect(submitted(`1250${decimal}5`)).toEqual({ ok: true, value: 1250.5 });
  });

  it('reads back a grouped whole number as the number, not as a fraction', () => {
    expect(submitted('1234')).toEqual({ ok: true, value: 1234 });
    expect(submitted('12345')).toEqual({ ok: true, value: 12345 });
  });

  it('submits a half-typed decimal as the whole number in front of it', () => {
    expect(submitted(`12${decimal}`)).toEqual({ ok: true, value: 12 });
    expect(submitted(`1234${decimal}`)).toEqual({ ok: true, value: 1234 });
  });

  it('still refuses what no amount may be', () => {
    expect(submitted('0')).toEqual({ ok: false, error: 'notPositive' });
    expect(submitted('')).toEqual({ ok: false, error: 'empty' });
    expect(submitted('9'.repeat(MAX_INTEGER_DIGITS))).toEqual({ ok: false, error: 'tooLarge' });
  });
});

const UNGROUPED: AmountSeparators = { group: '', decimal: '.' };

describe('canonicalAmount', () => {
  it('drops the group mark', () => {
    expect(canonicalAmount('1,234', DEFAULT_SEPARATORS)).toBe('1234');
    expect(canonicalAmount('1,234,567.89', DEFAULT_SEPARATORS)).toBe('1234567.89');
  });

  it('normalises the decimal mark to a dot', () => {
    expect(canonicalAmount('12.345,5', SWAPPED)).toBe('12345.5');
    expect(canonicalAmount('0,5', SWAPPED)).toBe('0.5');
  });

  it('reads the locale grouping mark as grouping, not as a decimal', () => {
    expect(canonicalAmount('1.234', SWAPPED)).toBe('1234');
  });

  it('drops a decimal mark with nothing behind it', () => {
    expect(canonicalAmount('12.', DEFAULT_SEPARATORS)).toBe('12');
    expect(canonicalAmount('1,234.', DEFAULT_SEPARATORS)).toBe('1234');
    expect(canonicalAmount('12,', SWAPPED)).toBe('12');
  });

  it('leaves a locale that does not group alone', () => {
    expect(canonicalAmount('1234567.5', UNGROUPED)).toBe('1234567.5');
  });

  it('leaves an empty field empty, which parseAmount answers as empty', () => {
    expect(canonicalAmount('', DEFAULT_SEPARATORS)).toBe('');
    expect(parseAmount(canonicalAmount('', DEFAULT_SEPARATORS))).toEqual({
      ok: false,
      error: 'empty',
    });
  });
});
