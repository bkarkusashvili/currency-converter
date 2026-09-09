/**
 * Display names for the indicators the API's terminus report carries. An
 * indicator added later is shown under its own name rather than hidden, which
 * is why this is a lookup and not a union.
 */
const INDICATOR_LABELS: Record<string, string> = {
  redis: 'Redis',
  mongodb: 'MongoDB',
  monobank: 'Monobank',
};

export function indicatorLabel(name: string): string {
  return INDICATOR_LABELS[name] ?? name;
}
