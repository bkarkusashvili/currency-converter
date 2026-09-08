import { describe, expect, it } from 'vitest';
import { parseAmount } from './amount';

describe('parseAmount', () => {
  it('accepts a positive decimal and normalises a comma separator', () => {
    expect(parseAmount(' 250,75 ')).toEqual({ ok: true, value: 250.75 });
    expect(parseAmount('100')).toEqual({ ok: true, value: 100 });
  });

  it('rejects an empty value', () => {
    expect(parseAmount('   ')).toEqual({ ok: false, message: 'Enter an amount to convert.' });
  });

  it('rejects values that are not numbers', () => {
    expect(parseAmount('ten')).toMatchObject({ ok: false });
    expect(parseAmount('1e')).toMatchObject({ ok: false });
  });

  it('rejects zero and negative amounts', () => {
    expect(parseAmount('0')).toEqual({
      ok: false,
      message: 'Amount must be greater than zero.',
    });
    expect(parseAmount('-5')).toEqual({
      ok: false,
      message: 'Amount must be greater than zero.',
    });
  });

  it('rejects amounts above the contract maximum', () => {
    expect(parseAmount('1000000000001')).toMatchObject({ ok: false });
    expect(parseAmount('1000000000000')).toEqual({ ok: true, value: 1_000_000_000_000 });
  });
});
