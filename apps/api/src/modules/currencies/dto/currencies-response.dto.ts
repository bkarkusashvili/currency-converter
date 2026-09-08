import { ApiProperty } from '@nestjs/swagger';
import { CurrencyDto } from './currency.dto';

export class CurrenciesResponseDto {
  @ApiProperty({
    description:
      'Every currency the current snapshot can quote, sorted by code. The ' +
      'list follows the upstream: a pair it stops publishing leaves it.',
    type: [CurrencyDto],
  })
  currencies!: CurrencyDto[];
}
