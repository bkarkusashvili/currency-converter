import { optionName, type CurrencyOption } from './currencyOptions';

/** Where a query was found in a string, so the row can wrap exactly that much in a `<mark>`. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface CurrencyMatch {
  option: CurrencyOption;
  /** The name worth showing, by `optionName`'s rule; absent when the code is all there is. */
  name: string | undefined;
  codeMatch: MatchRange | null;
  nameMatch: MatchRange | null;
}

/**
 * The filter the design states on board `1o`: "matches code prefix first, then
 * name substring". Two buckets rather than one scored list — someone typing
 * `eu` wants EUR at the top and not behind every name with "eu" in the middle
 * of it — and the API's order inside each, which is by code.
 *
 * An empty query is every currency, unmarked: the list is short enough to read.
 */
export function filterCurrencies(
  options: readonly CurrencyOption[],
  query: string,
): CurrencyMatch[] {
  const needle = query.trim().toLowerCase();

  if (needle === '') {
    return options.map((option) => ({
      option,
      name: optionName(option),
      codeMatch: null,
      nameMatch: null,
    }));
  }

  const byCode: CurrencyMatch[] = [];
  const byName: CurrencyMatch[] = [];

  for (const option of options) {
    const name = optionName(option);

    if (option.code.toLowerCase().startsWith(needle)) {
      byCode.push({ option, name, codeMatch: { start: 0, end: needle.length }, nameMatch: null });
      continue;
    }

    const found = name === undefined ? -1 : name.toLowerCase().indexOf(needle);
    if (found !== -1) {
      byName.push({
        option,
        name,
        codeMatch: null,
        nameMatch: { start: found, end: found + needle.length },
      });
    }
  }

  return [...byCode, ...byName];
}
