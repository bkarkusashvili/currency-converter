/**
 * What the form opens on, and the only codes it can offer when no currency
 * list is available at all — neither from the API nor from the persisted copy.
 */
export const DEFAULT_FROM = 'USD';

export const DEFAULT_TO = 'UAH';

export const DEFAULT_CURRENCY_CODES: readonly string[] = [DEFAULT_FROM, DEFAULT_TO];
