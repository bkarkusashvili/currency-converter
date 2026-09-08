import { ApiProperty } from '@nestjs/swagger';
import { ConversionRecordDto } from './conversion-record.dto';

export class HistoryResponseDto {
  @ApiProperty({
    description:
      'The most recent conversions, newest first. Empty when nothing has ' +
      'been converted yet — an unreachable store answers 503 instead, so an ' +
      'empty page always means what it says.',
    type: [ConversionRecordDto],
  })
  items!: ConversionRecordDto[];
}
