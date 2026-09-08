import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { HistoryQueryDto } from './dto/history-query.dto';
import { HistoryResponseDto } from './dto/history-response.dto';
import { HistoryService } from './history.service';

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  @ApiOperation({
    summary: 'List the most recent conversions the API answered',
    description:
      'Newest first. Each entry carries the rate and the provenance the ' +
      'conversion was answered with, so a result can be reconciled against ' +
      'rates that have moved since.',
  })
  @ApiOkResponse({
    description: 'The most recent conversions, newest first.',
    type: HistoryResponseDto,
  })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  async list(@Query() query: HistoryQueryDto): Promise<HistoryResponseDto> {
    return { items: await this.history.recent(query.limit) };
  }
}
