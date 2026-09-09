import { describe, expect, it } from 'vitest';
import { filterCurrencies } from '../lib/currencyFilter';

const CURRENCIES = [
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'EUR', name: 'Euro' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'XDR', name: 'XDR' },
];

function codes(query: string): string[] {
  return filterCurrencies(CURRENCIES, query).map((match) => match.option.code);
}

describe('filterCurrencies', () => {
  it('offers the whole list, unmarked, until something is typed', () => {
    const matches = filterCurrencies(CURRENCIES, '   ');

    expect(matches).toHaveLength(CURRENCIES.length);
    expect(matches.every((match) => match.codeMatch === null && match.nameMatch === null)).toBe(
      true,
    );
  });

  it('matches a name substring when no code starts with the query', () => {
    expect(codes('kr')).toEqual(['DKK', 'SEK']);
  });

  it('keeps a code prefix first even when the query also matches names', () => {
    // DKK is the only code starting with `d`; Swedish and Dollar carry one in
    // the middle, and come after it in the order the API listed them.
    expect(codes('d')).toEqual(['DKK', 'SEK', 'USD']);
  });

  it('ignores case on both sides', () => {
    expect(codes('EuR')).toEqual(['EUR']);
    expect(codes('DOLLAR')).toEqual(['USD']);
  });

  it('says where the match is, so the row can mark exactly that much', () => {
    const [euro] = filterCurrencies(CURRENCIES, 'eu');
    expect(euro?.codeMatch).toEqual({ start: 0, end: 2 });
    expect(euro?.nameMatch).toBeNull();

    const [krone] = filterCurrencies(CURRENCIES, 'kron');
    expect(krone?.option.code).toBe('DKK');
    expect(krone?.nameMatch).toEqual({ start: 7, end: 11 });
  });

  it('matches nothing rather than everything on a query no currency carries', () => {
    expect(codes('zzz')).toEqual([]);
  });

  it('has no name to match on when the API sent none worth showing', () => {
    // `optionName` drops a name that only repeats the code, so XDR is code-only
    // and only its code can be searched.
    expect(filterCurrencies(CURRENCIES, 'xd').map((match) => match.name)).toEqual([undefined]);
    expect(codes('XDR')).toEqual(['XDR']);
  });
});
