import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResponseWarningDto } from '../../../common/warnings';
import { RatesSource } from '../domain/rates-source.enum';
import { ExchangeRateDto } from './exchange-rate.dto';

export class RatesSnapshotResponseDto {
  @ApiProperty({
    description:
      'Where this snapshot came from. `stale-cache` means the upstream could ' +
      'not be reached and the fallback copy was served instead, so the rates ' +
      'are older than the cache TTL.',
    enum: RatesSource,
    example: RatesSource.Cache,
  })
  source!: RatesSource;

  @ApiProperty({
    description:
      'When the upstream fetch that produced these rates ran, ISO 8601.',
    example: '2026-09-08T12:00:00.000Z',
  })
  fetchedAt!: string;

  @ApiProperty({
    description: 'Every pair the upstream published that this API can quote.',
    type: [ExchangeRateDto],
    example: [
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        sell: 44.831,
        date: '2026-09-08T11:00:00.000Z',
      },
      {
        base: 'BTC',
        quote: 'USD',
        cross: 60.7562,
        date: '2026-09-08T11:00:00.000Z',
      },
    ],
  })
  rates!: ExchangeRateDto[];

  @ApiPropertyOptional({
    description:
      'What degraded while this request was answered. Absent when nothing ' +
      'did: the request succeeded either way, and this is what the client ' +
      'should know about how the answer was produced.',
    type: [ResponseWarningDto],
    example: [
      {
        code: 'CACHE_UNAVAILABLE',
        message:
          'The rates cache could not be reached during this request, so it ' +
          'was not used; `source` says where the rates came from.',
      },
    ],
  })
  warnings?: ResponseWarningDto[];
}
