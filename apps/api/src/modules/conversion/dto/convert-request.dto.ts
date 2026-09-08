import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
} from 'class-validator';
import { toUpperCase } from '../../../common/validation/to-upper-case';
import { ConversionRequest } from '../domain/conversion-request';

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

// A trillion, the bound §3 states. Above roughly nine quadrillion a double
// stops holding whole units exactly, and a limit far below that is what keeps
// a result the client can reconcile.
const MAX_AMOUNT = 1_000_000_000_000;

// The codes are typed as the strings they are on the wire rather than as
// CurrencyCode: an alias in a decorated signature erases to Object in the
// metadata Swagger reads, which would document a code as an object.
export class ConvertRequestDto implements ConversionRequest {
  @ApiProperty({
    description:
      'ISO 4217 alpha-3 code to convert from. Case-insensitive; the response ' +
      'echoes it upper-cased.',
    example: 'EUR',
    minLength: 3,
    maxLength: 3,
    pattern: CURRENCY_CODE.source,
  })
  @IsString()
  @Length(3, 3)
  @Matches(CURRENCY_CODE)
  @Transform(toUpperCase)
  from!: string;

  @ApiProperty({
    description: 'ISO 4217 alpha-3 code to convert to, on the same terms.',
    example: 'GBP',
    minLength: 3,
    maxLength: 3,
    pattern: CURRENCY_CODE.source,
  })
  @IsString()
  @Length(3, 3)
  @Matches(CURRENCY_CODE)
  @Transform(toUpperCase)
  to!: string;

  @ApiProperty({
    description:
      'How much of `from` to convert. A JSON number, not a string: the API ' +
      'does not coerce, so "100" is a validation error rather than a silent ' +
      'reinterpretation of what was sent.',
    example: 100,
    minimum: 0,
    exclusiveMinimum: true,
    maximum: MAX_AMOUNT,
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount!: number;
}
