import { describe, expect, it } from 'vitest';
import { canonicalAmount } from '../lib/canonicalAmount';
import { DEFAULT_SEPARATORS, type AmountSeparators } from '../lib/formatAmountInput';
import { parseAmount } from '../lib/parseAmount';

/** What a German or French keyboard hands the field. */
const SWAPPED: AmountSeparators = { group: '.', decimal: ',' };
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
