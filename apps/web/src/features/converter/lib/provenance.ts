import type { BadgeTone } from '../../../components/InfoBadge';

export const HUB_CURRENCY = 'UAH';

/** The one source that is not the API's: this client priced it from a stored snapshot. */
export const OFFLINE_ESTIMATE = 'offline-estimate';

interface Copy {
  valueKey: string | null;
  noteKey: string;
  tone: BadgeTone;
}

const STRATEGY_COPY = {
  identity: {
    valueKey: 'converter.strategy.identity.value',
    noteKey: 'converter.strategy.identity.note',
    tone: 'neutral',
  },
  direct: {
    valueKey: 'converter.strategy.direct.value',
    noteKey: 'converter.strategy.direct.note',
    tone: 'neutral',
  },
  cross: {
    valueKey: 'converter.strategy.cross.value',
    noteKey: 'converter.strategy.cross.note',
    tone: 'neutral',
  },
} as const satisfies Record<string, Copy>;

const UNKNOWN_STRATEGY = {
  valueKey: null,
  noteKey: 'converter.strategy.unknown.note',
  tone: 'neutral',
} as const satisfies Copy;

const SOURCE_COPY = {
  cache: {
    valueKey: 'converter.source.cache.value',
    noteKey: 'converter.source.cache.note',
    tone: 'neutral',
  },
  provider: {
    valueKey: 'converter.source.provider.value',
    noteKey: 'converter.source.provider.note',
    tone: 'accent',
  },
  'stale-cache': {
    valueKey: 'converter.source.stale-cache.value',
    noteKey: 'converter.source.stale-cache.note',
    tone: 'warn',
  },
  [OFFLINE_ESTIMATE]: {
    valueKey: 'converter.source.offline-estimate.value',
    noteKey: 'converter.source.offline-estimate.note',
    tone: 'warn',
  },
} as const satisfies Record<string, Copy>;

const UNKNOWN_SOURCE = {
  valueKey: null,
  noteKey: 'converter.source.unknown.note',
  tone: 'neutral',
} as const satisfies Copy;

/** `valueKey` is `null` when the API reported a value this client does not know: show it as returned. */
export function strategyCopy(strategy: string) {
  return Object.hasOwn(STRATEGY_COPY, strategy)
    ? STRATEGY_COPY[strategy as keyof typeof STRATEGY_COPY]
    : UNKNOWN_STRATEGY;
}

export function sourceCopy(source: string) {
  return Object.hasOwn(SOURCE_COPY, source)
    ? SOURCE_COPY[source as keyof typeof SOURCE_COPY]
    : UNKNOWN_SOURCE;
}

/** An unknown strategy falls back to the two endpoints rather than inventing a hop. */
export function conversionPath(from: string, to: string, strategy: string): string[] {
  if (strategy === 'identity') {
    return [from];
  }
  return strategy === 'cross' ? [from, HUB_CURRENCY, to] : [from, to];
}
