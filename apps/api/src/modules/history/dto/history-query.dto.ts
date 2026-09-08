import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '../domain/history-limits';

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
  //
  // The integer check is declared last of the three so it is the first the pipe
  // evaluates — constraints run bottom-up — and `?limit=abc` is reported as the
  // integer it is not rather than as a number too large for the page.
  @Max(MAX_HISTORY_LIMIT)
  @Min(1)
  @IsInt()
  @Type(() => Number)
  limit: number = DEFAULT_HISTORY_LIMIT;
}
