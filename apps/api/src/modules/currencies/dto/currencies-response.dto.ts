import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResponseWarningDto } from '../../../common/warnings/response-warning.dto';
import { CurrencyDto } from './currency.dto';

export class CurrenciesResponseDto {
  @ApiProperty({
    description:
      'Every currency the current snapshot can quote, sorted by code. The ' +
      'list follows the upstream: a pair it stops publishing leaves it.',
    type: [CurrencyDto],
    example: [
      { code: 'EUR', numericCode: 978, name: 'Euro' },
      { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
      { code: 'USD', numericCode: 840, name: 'US Dollar' },
    ],
  })
  currencies!: CurrencyDto[];

  @ApiPropertyOptional({
    description:
      'What degraded while this request was answered. Absent when nothing ' +
      'did. The list is a projection of the same snapshot /rates serves, so ' +
      'it is reached the same way and costs the same when the cache is down.',
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
