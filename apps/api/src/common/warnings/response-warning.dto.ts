import { ApiProperty } from '@nestjs/swagger';
import { ResponseWarning, WARNING_CODES } from './response-warning';
import type { WarningCode } from './response-warning';

export class ResponseWarningDto implements ResponseWarning {
  @ApiProperty({
    description:
      'What degraded. `CACHE_UNAVAILABLE` means the rates cache could not be ' +
      'reached, so the rates were fetched from the upstream and not cached; ' +
      '`HISTORY_NOT_RECORDED` means the conversion was answered but not ' +
      'stored, so it will not appear in `/history`.',
    enum: WARNING_CODES,
    example: 'CACHE_UNAVAILABLE',
  })
  code!: WarningCode;

  @ApiProperty({
    description: 'The degradation in a sentence, safe to show to a user.',
    example:
      'The rates cache could not be reached, so these rates were fetched ' +
      'from the upstream and could not be cached for the next request.',
  })
  message!: string;
}
