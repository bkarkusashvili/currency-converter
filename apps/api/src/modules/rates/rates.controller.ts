import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards';
import { collectWarnings } from '../../common/warnings';
import { ADMIN_SECURITY_SCHEME, ApiErrorResponses } from '../../common/swagger';
import { RateHistoryService } from './application/rate-history.service';
import { RatesService } from './application/rates.service';
import { RatesHistoryQueryDto } from './dto/rates-history-query.dto';
import { RatesHistoryResponseDto } from './dto/rates-history-response.dto';
import { RatesSnapshotResponseDto } from './dto/rates-snapshot-response.dto';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(
    private readonly rates: RatesService,
    private readonly history: RateHistoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Return the exchange rate snapshot the API converts with',
  })
  @ApiOkResponse({
    description:
      'The current snapshot, with the source it was served from. A 200 with ' +
      '`stale-cache` is a degraded answer, not a fresh one, and a `warnings` ' +
      'entry says what could not be reached while it was produced.',
    type: RatesSnapshotResponseDto,
  })
  @ApiErrorResponses(
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  async getRates(): Promise<RatesSnapshotResponseDto> {
    const { snapshot, source, cacheDegraded, archiveDegraded } =
      await this.rates.getSnapshot();
    const warnings = collectWarnings({
      CACHE_UNAVAILABLE: cacheDegraded,
      ARCHIVE_NOT_RECORDED: archiveDegraded,
    });
    const answer = {
      source,
      fetchedAt: snapshot.fetchedAt,
      rates: snapshot.rates,
    };

    // Spread rather than assigned undefined: a healthy answer is exactly the
    // one this route has always given, down to the absent key.
    return warnings === undefined ? answer : { ...answer, warnings };
  }

  // A literal segment, not a parameter, so nothing above can shadow it and it
  // shadows nothing: `/rates` and `/rates/history` are two paths.
  @Get('history')
  @ApiOperation({
    summary: 'Return the archived daily rates for one published pair',
    description:
      'One point per archived UTC day inside the window that published the ' +
      'pair, oldest first. The archive holds the last snapshot of each day, ' +
      'so a point is that day at its close rather than an average of it, and ' +
      "the orientation is the upstream's own: `base`/`quote` is asked for " +
      'exactly as published, never inverted or crossed.',
  })
  @ApiOkResponse({
    description:
      'The archived series, oldest first. Shorter than `days` wherever the ' +
      'archive has a gap.',
    type: RatesHistoryResponseDto,
  })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  getHistory(
    @Query() query: RatesHistoryQueryDto,
  ): Promise<RatesHistoryResponseDto> {
    return this.history.series(query);
  }

  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity(ADMIN_SECURITY_SCHEME)
  @ApiOperation({
    summary:
      'Drop both cache keys so the next read refetches from the upstream',
  })
  @ApiNoContentResponse({
    description:
      'Both the fresh and the fallback key are gone. Answered even when they ' +
      'were already absent: the request states the wanted end state. A cache ' +
      'that could not be reached answers `503 CACHE_UNAVAILABLE` instead, ' +
      'because the keys are still there.',
  })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  invalidate(): Promise<void> {
    return this.rates.invalidate();
  }
}
