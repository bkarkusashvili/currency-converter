import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// The wire shape of ExchangeRate. A class rather than the domain interface
// because an interface is erased before Swagger sees it, and because the
// domain should not have to carry decorators from the HTTP layer. The codes
// are typed as the strings they are on the wire rather than as CurrencyCode:
// an alias in a decorated signature erases to Object in the metadata Swagger
// reads, which would document a code as an object.
//
// Monobank quotes one unit of `base` in `quote`, so USD/UAH buy 44.35 means
// the bank pays 44.35 hryvnia for a dollar. A pair carries either buy and
// sell or a single cross rate, never both.
export class ExchangeRateDto {
  @ApiProperty({
    description: 'ISO 4217 alpha-3 code of the currency being priced.',
    example: 'USD',
  })
  base!: string;

  @ApiProperty({
    description: 'ISO 4217 alpha-3 code the price is expressed in.',
    example: 'UAH',
  })
  quote!: string;

  @ApiPropertyOptional({
    description: 'What the bank pays in `quote` for one unit of `base`.',
    example: 44.35,
  })
  buy?: number;

  @ApiPropertyOptional({
    description: 'What the bank charges in `quote` for one unit of `base`.',
    example: 44.831,
  })
  sell?: number;

  @ApiPropertyOptional({
    description:
      'Mid rate, published instead of a buy and sell pair for the currencies ' +
      'the bank quotes without a spread.',
    example: 60.7562,
  })
  cross?: number;

  @ApiProperty({
    description:
      'When the upstream quoted this rate, ISO 8601. Older than `fetchedAt`: ' +
      'it is the age of the price, not of the request that read it.',
    example: '2026-09-08T11:00:00.000Z',
  })
  date!: string;
}
