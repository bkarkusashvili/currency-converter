import { ApiPropertyOptions } from '@nestjs/swagger';
import { ConversionStrategyName } from './conversion-strategy-name.enum';

// What a conversion publishes about itself, as OpenAPI option objects. A stored
// record is the conversion that was answered plus the two fields the store owns
// (§3), so the two DTOs describe these fields identically — and a second copy of
// eight descriptions is one that drifts from the first.
//
// Option objects rather than a base class: this is shared vocabulary, and a DTO
// inheriting from another feature's DTO is a runtime edge between two modules
// that §9 says nothing has. Each DTO still declares its own properties, so
// what a route publishes is readable in the class that publishes it.
//
// `source` is not here: its enum belongs to the rates module, and a file under
// `common/` importing from a feature is the edge this file exists to avoid. The
// two DTOs that carry provenance name `RatesSource` themselves.
export const CONVERSION_PROPERTIES = {
  from: {
    description: 'The code that was converted from, upper-cased.',
    example: 'EUR',
  },

  to: {
    description: 'The code that was converted to, upper-cased.',
    example: 'GBP',
  },

  amount: {
    description: 'The amount that was converted, as it was sent.',
    example: 100,
  },

  result: {
    description:
      'The converted amount, rounded half-up to two decimals. Computed from ' +
      'the unrounded rate, so it is the amount the rate below explains rather ' +
      'than the one six decimals of it would reproduce. An amount worth less ' +
      'than half a minor unit of `to` rounds to `0` — 0.01 UAH is 0.000223 ' +
      'USD — which is an answer rather than an error, and `rate` is what ' +
      'explains it.',
    example: 84.73,
  },

  rate: {
    description:
      'The effective `to` per `from` rate the conversion used, rounded ' +
      'half-up to six decimals.',
    example: 0.847312,
  },

  strategy: {
    description:
      'How the rate was arrived at. `direct` is a pair the upstream ' +
      'publishes; `cross` composes two of them through the hryvnia and so ' +
      'pays a spread twice; `identity` is a currency converted to itself.',
    enum: ConversionStrategyName,
    example: ConversionStrategyName.Cross,
  },

  ratesTimestamp: {
    description:
      'When the upstream fetch that produced these rates ran, ISO 8601. Read ' +
      'it with `source`: it is how old the quote behind this result is.',
    example: '2026-09-08T12:00:00.000Z',
  },
} satisfies Record<string, ApiPropertyOptions>;
