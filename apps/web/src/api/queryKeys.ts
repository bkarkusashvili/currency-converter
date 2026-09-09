export const queryKeys = {
  currencies: ['currencies'] as const,
  rates: ['rates'] as const,
  health: ['health'] as const,
  history: {
    all: ['history'] as const,
    list: (limit: number) => ['history', limit] as const,
  },
  /**
   * A root of its own rather than a branch of `rates`, because the two are
   * different answers with different lifetimes — and because the persistence
   * allow-list keys on the root: a series under `rates` would be written to
   * localStorage with the snapshot.
   */
  rateHistory: {
    all: ['rateHistory'] as const,
    pair: (base: string, quote: string, days: number) =>
      ['rateHistory', base, quote, days] as const,
  },
} as const;
