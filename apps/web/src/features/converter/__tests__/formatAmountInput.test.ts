import { describe, expect, it } from 'vitest';
import {
  formatAmountInput,
  MAX_INTEGER_DIGITS,
  type AmountSeparators,
} from '../lib/formatAmountInput';
import { MAX_AMOUNT, parseAmount } from '../lib/parseAmount';

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

describe('what the form then parses', () => {
  it('produces a value parseAmount reads back as the number typed', () => {
    expect(parseAmount(formatAmountInput('1234567.89', 10).value)).toEqual({
      ok: true,
      value: 1234567.89,
    });
    expect(parseAmount(formatAmountInput('1250.5', 6).value)).toEqual({ ok: true, value: 1250.5 });
  });
});
