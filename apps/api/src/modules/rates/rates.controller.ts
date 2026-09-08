import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { collectWarnings } from '../../common/warnings/collect-warnings';
import { ADMIN_SECURITY_SCHEME } from '../../common/swagger/build-swagger-config';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { RatesService } from './application/rates.service';
import { RatesSnapshotResponseDto } from './dto/rates-snapshot-response.dto';

@ApiTags('rates')
@Controller('rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

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
    const { snapshot, source, cacheDegraded } = await this.rates.getSnapshot();
    const warnings = collectWarnings({ CACHE_UNAVAILABLE: cacheDegraded });
    const answer = {
      source,
      fetchedAt: snapshot.fetchedAt,
      rates: snapshot.rates,
    };

    // Spread rather than assigned undefined: a healthy answer is exactly the
    // one this route has always given, down to the absent key.
    return warnings === undefined ? answer : { ...answer, warnings };
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
      'were already absent: the request states the wanted end state.',
  })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  invalidate(): Promise<void> {
    return this.rates.invalidate();
  }
}
