import type { BadgeTone } from '../../components/InfoBadge';
import type { ConversionStrategy, RateSource } from '../../api/types';

interface ProvenanceCopy {
  value: string;
  tooltip: string;
  note: string;
  tone: BadgeTone;
}

export const HUB_CURRENCY = 'UAH';

export const STRATEGY_COPY: Record<ConversionStrategy, ProvenanceCopy> = {
  identity: {
    value: 'identity',
    tooltip: 'Both sides are the same currency, so the rate is exactly 1.',
    note: 'Both sides are the same currency, so nothing was converted.',
    tone: 'neutral',
  },
  direct: {
    value: 'direct',
    tooltip: 'Monobank publishes this pair, so its rate was used as it stands.',
    note: 'Monobank publishes this pair, so its rate was used as it stands.',
    tone: 'neutral',
  },
  cross: {
    value: 'cross',
    tooltip: `No published pair, so the rate is derived through ${HUB_CURRENCY}.`,
    note: `No pair is published for these two currencies, so the rate was derived through ${HUB_CURRENCY}.`,
    tone: 'neutral',
  },
};

export const SOURCE_COPY: Record<RateSource, ProvenanceCopy> = {
  cache: {
    value: 'cache',
    tooltip: 'Served from the cached rate snapshot, refreshed every five minutes.',
    note: 'Served from the cached rate snapshot.',
    tone: 'neutral',
  },
  provider: {
    value: 'provider',
    tooltip: 'Fetched from Monobank while handling this request.',
    note: 'Fetched from Monobank while handling this request.',
    tone: 'accent',
  },
  'stale-cache': {
    value: 'stale cache',
    tooltip: 'Monobank was unreachable, so the last good snapshot was used.',
    note: 'Monobank was unreachable, so the last good snapshot was used. This rate may be out of date.',
    tone: 'warn',
  },
};
