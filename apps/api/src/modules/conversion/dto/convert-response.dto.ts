import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONVERSION_PROPERTIES } from '../../../common/conversion/conversion-api-properties.constants';
import type { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name.enum';
import { ResponseWarningDto } from '../../../common/warnings/response-warning.dto';
import { RATES_SOURCES } from '../../rates/domain/exchange-rate.types';
import type { RatesSource } from '../../rates/domain/exchange-rate.types';
import { ConversionResult } from '../domain/conversion-result.types';

// The conversion as the client receives it: the domain result, plus what
// degraded while the request that produced it ran. The fields a stored record
// publishes the same way come from the shared option objects in `common/`, so
// the two descriptions cannot drift apart.
export class ConvertResponseDto implements ConversionResult {
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
      'is older than the cache TTL.',
    enum: RATES_SOURCES,
    example: 'cache',
  })
  source!: RatesSource;

  @ApiProperty(CONVERSION_PROPERTIES.ratesTimestamp)
  ratesTimestamp!: string;

  @ApiPropertyOptional({
    description:
      'What degraded while this request was answered. Absent when nothing ' +
      'did: the request succeeded either way, and this is what the client ' +
      'should know about how the answer was produced.',
    type: [ResponseWarningDto],
    example: [
      {
        code: 'CACHE_UNAVAILABLE',
        message:
          'The rates cache could not be reached during this request, so it ' +
          'was not used; `source` says where the rates came from.',
      },
    ],
  })
  warnings?: ResponseWarningDto[];
}
