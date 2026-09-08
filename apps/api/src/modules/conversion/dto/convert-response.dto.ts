import { ApiProperty } from '@nestjs/swagger';
import { RATES_SOURCES } from '../../rates/domain/rates-source';
import type { RatesSource } from '../../rates/domain/rates-source';
import { ConversionResult } from '../domain/conversion-result';
import { CONVERSION_STRATEGY_NAMES } from '../strategies/conversion-strategy-name';
import type { ConversionStrategyName } from '../strategies/conversion-strategy-name';

export class ConvertResponseDto implements ConversionResult {
  @ApiProperty({
    description: 'The code that was converted from, upper-cased.',
    example: 'EUR',
  })
  from!: string;

  @ApiProperty({
    description: 'The code that was converted to, upper-cased.',
    example: 'GBP',
  })
  to!: string;

  @ApiProperty({
    description: 'The amount that was converted, as it was sent.',
    example: 100,
  })
  amount!: number;

  @ApiProperty({
    description:
      'The converted amount, rounded half-up to two decimals. Computed from ' +
      'the unrounded rate, so it is the amount the rate below explains rather ' +
      'than the one six decimals of it would reproduce. An amount worth less ' +
      'than half a minor unit of `to` rounds to `0` — 0.01 UAH is 0.000223 ' +
      'USD — which is an answer rather than an error, and `rate` is what ' +
      'explains it.',
    example: 84.73,
  })
  result!: number;

  @ApiProperty({
    description:
      'The effective `to` per `from` rate the conversion used, rounded ' +
      'half-up to six decimals.',
    example: 0.847312,
  })
  rate!: number;

  @ApiProperty({
    description:
      'How the rate was arrived at. `direct` is a pair the upstream ' +
      'publishes; `cross` composes two of them through the hryvnia and so ' +
      'pays a spread twice; `identity` is a currency converted to itself.',
    enum: CONVERSION_STRATEGY_NAMES,
    example: 'cross',
  })
  strategy!: ConversionStrategyName;

  @ApiProperty({
    description:
      'Where the rates came from. `stale-cache` means the upstream could not ' +
      'be reached and the fallback copy priced this conversion, so the rate ' +
      'is older than the cache TTL.',
    enum: RATES_SOURCES,
    example: 'cache',
  })
  source!: RatesSource;

  @ApiProperty({
    description:
      'When the upstream fetch that produced these rates ran, ISO 8601. Read ' +
      'it with `source`: it is how old the quote behind this result is.',
    example: '2026-09-08T12:00:00.000Z',
  })
  ratesTimestamp!: string;
}
