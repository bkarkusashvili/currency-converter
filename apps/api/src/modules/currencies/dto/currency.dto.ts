import { ApiProperty } from '@nestjs/swagger';

export class CurrencyDto {
  @ApiProperty({
    description: 'ISO 4217 alpha-3 code, the form every other endpoint takes.',
    example: 'EUR',
  })
  code!: string;

  @ApiProperty({
    description:
      'ISO 4217 numeric code, for a client that stores currencies numerically.',
    example: 978,
  })
  numericCode!: number;

  @ApiProperty({
    description: 'English name from the ISO 4217 table.',
    example: 'Euro',
  })
  name!: string;
}
