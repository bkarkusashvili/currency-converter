import { ApiProperty } from '@nestjs/swagger';
import { ResponseWarning } from './response-warning.types';
import { WarningCode } from './warning-code.enum';

export class ResponseWarningDto implements ResponseWarning {
  @ApiProperty({
    description:
      'What degraded. `CACHE_UNAVAILABLE` means the rates cache could not be ' +
      'reached while the request was answered, so it was neither read nor ' +
      'written — read `source` for where the rates came from; ' +
      '`HISTORY_NOT_RECORDED` means the conversion was answered but not ' +
      'stored, so it will not appear in `/history`; ' +
      '`ARCHIVE_NOT_RECORDED` means the snapshot behind this answer was ' +
      'fetched but not archived, so it will not appear in `/rates/history`.',
    enum: WarningCode,
    example: WarningCode.CacheUnavailable,
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
