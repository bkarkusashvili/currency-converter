import type { Currency } from '../../../api/types';
import { DEFAULT_CURRENCY_CODES } from './defaultCurrencies';

export interface CurrencyOption {
  code: string;
  /** Absent when no list was available, or when the API has no name for the code. */
  name?: string;
}

/**
 * What the selects offer, in the order the app can trust: the list the API
 * answered with, which — when the request fails — is whatever the persisted
 * cache still holds, and the two defaults only when there is neither, so a
 * first visit to an unreachable API is still a usable form.
 */
export function currencyOptions(currencies: readonly Currency[] | undefined): CurrencyOption[] {
  if (currencies === undefined || currencies.length === 0) {
    return DEFAULT_CURRENCY_CODES.map((code) => ({ code }));
  }

  return currencies.map(({ code, name }) => ({ code, name }));
}

/** A name is worth showing only when it says something the code does not, so no select reads "USD — USD". */
export function optionName(option: CurrencyOption): string | undefined {
  const name = option.name?.trim();

  return name === undefined || name === '' || name === option.code ? undefined : name;
}
