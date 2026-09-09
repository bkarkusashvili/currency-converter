import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import {
  CURRENCY_CODE_LENGTH,
  CURRENCY_CODE_PATTERN,
  toUpperCase,
} from '../../../common/currency';
import {
  DEFAULT_RATE_HISTORY_DAYS,
  MAX_RATE_HISTORY_DAYS,
} from '../domain/rate-history-window.constants';
import { RateHistoryQuery } from '../domain/rate-history.types';

// Every field declares its type check *last*, for the reason ConvertRequestDto
// gives: the pipe stops at the first failure a field records and class-validator
// evaluates constraints bottom-up, so `?days=abc` is reported as the integer it
// is not rather than as a number outside the window.
//
// The codes are typed as the strings they are on the wire rather than as
// CurrencyCode: an alias in a decorated signature erases to Object in the
// metadata Swagger reads, which would document a code as an object.
export class RatesHistoryQueryDto implements RateHistoryQuery {
  @ApiProperty({
    description:
      'ISO 4217 alpha-3 code of the currency being priced, as the upstream ' +
      'publishes the pair. Case-insensitive; the response echoes it ' +
      'upper-cased.',
    example: 'USD',
    minLength: CURRENCY_CODE_LENGTH,
    maxLength: CURRENCY_CODE_LENGTH,
    pattern: CURRENCY_CODE_PATTERN.source,
  })
  @Matches(CURRENCY_CODE_PATTERN)
  @IsString()
  @Transform(toUpperCase)
  base!: string;

  @ApiProperty({
    description:
      'ISO 4217 alpha-3 code the price is expressed in, on the same terms. ' +
      'The orientation is exact: the archive is asked for the pair the ' +
      'upstream published, not for one derived from it.',
    example: 'UAH',
    minLength: CURRENCY_CODE_LENGTH,
    maxLength: CURRENCY_CODE_LENGTH,
    pattern: CURRENCY_CODE_PATTERN.source,
  })
  @Matches(CURRENCY_CODE_PATTERN)
  @IsString()
  @Transform(toUpperCase)
  quote!: string;

  @ApiPropertyOptional({
    description:
      'How many UTC days back to read, counting today as the first. The ' +
      'upper bound is the archive retention: a day past ' +
      '`RATES_ARCHIVE_TTL_DAYS` has already expired, so asking for one is a ' +
      'window that could never be answered rather than one answered short.',
    minimum: 1,
    maximum: MAX_RATE_HISTORY_DAYS,
    default: DEFAULT_RATE_HISTORY_DAYS,
    example: 7,
  })
  // A query string is text, and the global pipe does not convert implicitly, so
  // the conversion is opted into here. `?days=abc` then becomes NaN and fails
  // the integer check rather than reaching the query as a silent nothing.
  @Max(MAX_RATE_HISTORY_DAYS)
  @Min(1)
  @IsInt()
  @Type(() => Number)
  days: number = DEFAULT_RATE_HISTORY_DAYS;
}
