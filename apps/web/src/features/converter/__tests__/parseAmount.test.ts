import { describe, expect, it } from 'vitest';
import { parseAmount } from '../lib/parseAmount';

describe('parseAmount', () => {
  it.each([
    ['1,000', 1000],
    ['1,234.50', 1234.5],
    ['1.000,50', 1000.5],
    ['1,5', 1.5],
    ['100', 100],
    [' 250,75 ', 250.75],
    ['1 234,56', 1234.56],
    ['12,345,678', 12345678],
    ['1.5', 1.5],
    ['1000000000000', 1_000_000_000_000],
  ])('reads %s as %s', (input, value) => {
    expect(parseAmount(input)).toEqual({ ok: true, value });
  });

  it.each([
    ['1..5', 'notANumber'],
    ['abc', 'notANumber'],
    ['1e5', 'notANumber'],
    ['1,23.45', 'notANumber'],
    ['0', 'notPositive'],
    ['-1', 'notPositive'],
    ['   ', 'empty'],
    ['1000000000001', 'tooLarge'],
  ])('rejects %s as %s', (input, error) => {
    expect(parseAmount(input)).toEqual({ ok: false, error });
  });
});
