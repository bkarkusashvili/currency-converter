import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsPositive, IsString, Matches, Max } from 'class-validator';
import { toUpperCase } from '../../../common/validation/to-upper-case';
import { ConversionRequest } from '../domain/conversion-request';

// The whole rule for a code, and the only one: a length check beside it would
// report one mistake twice in `details.errors[].messages`, since a code of the
// wrong length is already a code that does not match. The `minLength` and
// `maxLength` below are for OpenAPI, which cannot read a pattern's quantifier.
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

// A trillion, the bound §3 states. Above roughly nine quadrillion a double
// stops holding whole units exactly, and a limit far below that is what keeps
// a result the client can reconcile.
const MAX_AMOUNT = 1_000_000_000_000;

// Every field declares its type check *last*. The pipe stops at the first
// failure a field records and class-validator evaluates constraints bottom-up,
// so the type check is the one that runs first and the one a wrong-typed value
// is reported against: declared the other way round, `amount: "100"` answers
// "must not be greater than 1000000000000", which is a consequence of NaN
// rather than the mistake.
//
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
  @Matches(CURRENCY_CODE)
  @IsString()
  @Transform(toUpperCase)
  from!: string;

  @ApiProperty({
    description: 'ISO 4217 alpha-3 code to convert to, on the same terms.',
    example: 'GBP',
    minLength: 3,
    maxLength: 3,
    pattern: CURRENCY_CODE.source,
  })
  @Matches(CURRENCY_CODE)
  @IsString()
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
  @Max(MAX_AMOUNT)
  @IsPositive()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  amount!: number;
}
