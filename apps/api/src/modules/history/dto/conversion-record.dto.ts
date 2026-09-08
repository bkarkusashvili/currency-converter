import { ApiProperty } from '@nestjs/swagger';
import { CONVERSION_STRATEGY_NAMES } from '../../conversion/strategies/conversion-strategy-name';
import type { ConversionStrategyName } from '../../conversion/strategies/conversion-strategy-name';
import { RATES_SOURCES } from '../../rates/domain/rates-source';
import type { RatesSource } from '../../rates/domain/rates-source';
import { ConversionRecord } from '../domain/conversion-record';

export class ConversionRecordDto implements ConversionRecord {
  @ApiProperty({
    description: 'Identifier of the stored record.',
    example: '6f0000000000000000000001',
  })
  id!: string;

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
    description: 'The amount that was converted.',
    example: 100,
  })
  amount!: number;

  @ApiProperty({
    description: 'The converted amount, as it was answered.',
    example: 84.73,
  })
  result!: number;

  @ApiProperty({
    description: 'The effective `to` per `from` rate the conversion used.',
    example: 0.847312,
  })
  rate!: number;

  @ApiProperty({
    description: 'How the rate was arrived at.',
    enum: CONVERSION_STRATEGY_NAMES,
    example: 'cross',
  })
  strategy!: ConversionStrategyName;

  @ApiProperty({
    description:
      'Where the rates came from. `stale-cache` means the conversion was ' +
      'priced from the fallback copy because the upstream could not be ' +
      'reached, which is what explains a rate that does not match the ones ' +
      'published around it.',
    enum: RATES_SOURCES,
    example: 'cache',
  })
  source!: RatesSource;

  @ApiProperty({
    description:
      'When the upstream fetch that produced the rates ran, ISO 8601. Read ' +
      'with `createdAt` it is how old the quote was when it was used.',
    example: '2026-09-08T12:00:00.000Z',
  })
  ratesTimestamp!: string;

  @ApiProperty({
    description: 'When the conversion was recorded, ISO 8601.',
    example: '2026-09-08T12:00:05.000Z',
  })
  createdAt!: string;
}
