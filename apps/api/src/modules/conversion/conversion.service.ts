import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  RATE_DECIMALS,
  RESULT_DECIMALS,
} from '../../common/money/money-decimals';
import { Money } from '../../common/money/money';
import { roundHalfUp } from '../../common/money/round-half-up';
import { HistoryService } from '../history/history.service';
import { RatesService } from '../rates/application/rates.service';
import { ConversionRequest } from './domain/conversion-request';
import { ConversionResult } from './domain/conversion-result';
import { ConversionStrategyResolver } from './strategies/conversion-strategy.resolver';

@Injectable()
export class ConversionService {
  constructor(
    private readonly rates: RatesService,
    private readonly resolver: ConversionStrategyResolver,
    private readonly history: HistoryService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ConversionService.name);
  }

  // One snapshot prices the whole conversion: reading the rates twice could
  // cross a cache expiry and compose two legs from two different sets.
  //
  // The result is computed from the unrounded rate and the published rate is
  // rounded separately, so a large amount is not multiplied by an error of up
  // to half a unit in the sixth decimal — a million pounds crossed to zloty
  // differ by 29 groszy between the two. §5 records the choice.
  //
  // The other end of the same scale is an amount worth less than half a minor
  // unit of `to`, which rounds to `0`: the answer is the money, and `rate` is
  // what explains it. §5 records that too.
  async convert({
    from,
    to,
    amount,
  }: ConversionRequest): Promise<ConversionResult> {
    const { snapshot, source } = await this.rates.getSnapshot();
    const strategy = this.resolver.resolve(from, to, snapshot.rates);
    const rate = strategy.rate(from, to, snapshot.rates);
    const result = roundHalfUp(new Money(amount).times(rate), RESULT_DECIMALS);

    this.logger.info(
      `Converted ${from} to ${to} at the ${strategy.name} rate from ${source} rates`,
    );
    // The amount is the one part of a conversion that says something about the
    // caller rather than about the rates, so the line that is on in production
    // carries the pair and how it was priced, and this one carries the money.
    this.logger.debug(`Converted ${amount} ${from} to ${result} ${to}`);

    const answer: ConversionResult = {
      from,
      to,
      amount,
      result,
      rate: roundHalfUp(rate, RATE_DECIMALS),
      strategy: strategy.name,
      source,
      ratesTimestamp: snapshot.fetchedAt,
    };

    // Awaited so a client that reads /history straight after a conversion finds
    // it there, and caught so a store that is down cannot turn a conversion the
    // client has already been priced for into a 500. The history service makes
    // the same promise; this is the seam keeping it, because the conversion is
    // the answer and the record is a side effect of it (§2).
    await this.history.record(answer).catch((error: unknown) => {
      this.logger.warn({ err: error }, 'Recording the conversion failed');
    });

    return answer;
  }
}
