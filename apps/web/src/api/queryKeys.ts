export const queryKeys = {
  currencies: ['currencies'] as const,
  health: ['health'] as const,
  history: {
    all: ['history'] as const,
    list: (limit: number) => ['history', limit] as const,
  },
} as const;
