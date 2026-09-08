import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 50;

export class HistoryQueryDto {
  @ApiPropertyOptional({
    description:
      'How many of the most recent conversions to return. The upper bound is ' +
      'the page, not the retention: older records exist until they expire.',
    minimum: 1,
    maximum: MAX_HISTORY_LIMIT,
    default: DEFAULT_HISTORY_LIMIT,
    example: 10,
  })
  // A query string is text, and the global pipe does not convert implicitly, so
  // the conversion is opted into here. `?limit=abc` then becomes NaN and fails
  // the integer check rather than reaching the query as a silent nothing.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_HISTORY_LIMIT)
  limit: number = DEFAULT_HISTORY_LIMIT;
}
