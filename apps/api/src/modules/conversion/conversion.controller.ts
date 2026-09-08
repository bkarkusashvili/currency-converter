import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { ConversionService } from './conversion.service';
import { ConvertRequestDto } from './dto/convert-request.dto';
import { ConvertResponseDto } from './dto/convert-response.dto';

@ApiTags('conversion')
@Controller('convert')
export class ConversionController {
  constructor(private readonly conversion: ConversionService) {}

  @Post()
  // A conversion creates nothing and leaves nothing behind to fetch, so Nest's
  // 201 for a POST would be describing a resource that does not exist.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convert an amount between two currencies',
    description:
      'Prices the pair from the snapshot the API is currently serving, ' +
      'reporting which strategy priced it and how old the rates are. The ' +
      'body is not coerced: `amount` must be a JSON number.',
  })
  @ApiOkResponse({
    description:
      'The converted amount, the effective rate, and the provenance of the ' +
      'rates it used. A `source` of `stale-cache` is a degraded answer ' +
      'priced from the fallback copy, not a fresh one.',
    type: ConvertResponseDto,
  })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  convert(@Body() request: ConvertRequestDto): Promise<ConvertResponseDto> {
    return this.conversion.convert(request);
  }
}
