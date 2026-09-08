import { ApiProperty } from '@nestjs/swagger';
import { ResponseWarning, WARNING_CODES } from './response-warning';
import type { WarningCode } from './response-warning';

export class ResponseWarningDto implements ResponseWarning {
  @ApiProperty({
    description:
      'What degraded. `CACHE_UNAVAILABLE` means the rates cache could not be ' +
      'reached while the request was answered, so it was neither read nor ' +
      'written — read `source` for where the rates came from; ' +
      '`HISTORY_NOT_RECORDED` means the conversion was answered but not ' +
      'stored, so it will not appear in `/history`.',
    enum: WARNING_CODES,
    example: 'CACHE_UNAVAILABLE',
  })
  code!: WarningCode;

  @ApiProperty({
    description: 'The degradation in a sentence, safe to show to a user.',
    example:
      'The rates cache could not be reached during this request, so it was ' +
      'not used; `source` says where the rates came from.',
  })
  message!: string;
}
