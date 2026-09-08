import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/swagger/api-error-responses.decorator';
import { RatesService } from '../rates/application/rates.service';
import { collectCurrencies } from './collect-currencies';
import { CurrenciesResponseDto } from './dto/currencies-response.dto';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @ApiOperation({
    summary: 'List the currencies the current snapshot can convert between',
  })
  @ApiOkResponse({
    description:
      'The currencies of the current snapshot, sorted by code. Derived from ' +
      'the same snapshot a conversion uses, so a code listed here is a code ' +
      'the API can quote right now.',
    type: CurrenciesResponseDto,
  })
  @ApiErrorResponses(
    HttpStatus.TOO_MANY_REQUESTS,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  async list(): Promise<CurrenciesResponseDto> {
    const { snapshot } = await this.rates.getSnapshot();

    return { currencies: collectCurrencies(snapshot.rates) };
  }
}
