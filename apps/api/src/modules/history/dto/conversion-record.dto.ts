import { ApiProperty } from '@nestjs/swagger';
import { CONVERSION_PROPERTIES } from '../../../common/conversion/conversion-api-properties';
import type { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name';
import { RATES_SOURCES } from '../../rates/domain/rates-source';
import type { RatesSource } from '../../rates/domain/rates-source';
import { ConversionRecord } from '../domain/conversion-record';

// A record is the conversion that was answered plus the two fields the store
// owns. It declares its own properties rather than inheriting the convert
// response's: a DTO of one feature module extending another's is a runtime edge
// between the two, and §9's graph has none. What the two responses genuinely
// publish the same way is shared as option objects in `common/`, so the eight
// descriptions still exist once.
//
// `warnings` is the one part of an answer that is not part of the conversion:
// it says what degraded while the request ran, which is a fact about that
// request rather than about what was converted. The record has never carried it
// and `NewConversionRecord` has no place for it — `swagger.e2e-spec.ts` pins
// the property set this publishes.
export class ConversionRecordDto implements ConversionRecord {
  @ApiProperty({
    description: 'Identifier of the stored record.',
    example: '6f0000000000000000000001',
  })
  id!: string;

  @ApiProperty(CONVERSION_PROPERTIES.from)
  from!: string;

  @ApiProperty(CONVERSION_PROPERTIES.to)
  to!: string;

  @ApiProperty(CONVERSION_PROPERTIES.amount)
  amount!: number;

  @ApiProperty(CONVERSION_PROPERTIES.result)
  result!: number;

  @ApiProperty(CONVERSION_PROPERTIES.rate)
  rate!: number;

  @ApiProperty(CONVERSION_PROPERTIES.strategy)
  strategy!: ConversionStrategyName;

  @ApiProperty({
    description:
      'Where the rates came from. `stale-cache` means the upstream could not ' +
      'be reached and the fallback copy priced this conversion, so the rate ' +
      'is older than the cache TTL — which is what explains a stored rate ' +
      'that does not match the ones published around it.',
    enum: RATES_SOURCES,
    example: 'cache',
  })
  source!: RatesSource;

  @ApiProperty(CONVERSION_PROPERTIES.ratesTimestamp)
  ratesTimestamp!: string;

  @ApiProperty({
    description:
      'When the conversion was recorded, ISO 8601. Read with ' +
      '`ratesTimestamp` it is how old the quote was when it was used.',
    example: '2026-09-08T12:00:05.000Z',
  })
  createdAt!: string;
}
