import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  Money,
  RATE_DECIMALS,
  RESULT_DECIMALS,
  roundHalfUp,
} from '../../common/money';
import { HistoryService } from '../history';
import { RatesService } from '../rates';
import { ConversionOutcome } from './domain/conversion-outcome.types';
import { ConversionRequest } from './domain/conversion-request.types';
import { ConversionResult } from './domain/conversion-result.types';
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
  //
  // What comes back is the conversion and what answering it cost, not the
  // response: the warnings §3 publishes are assembled in the controller, where
  // /rates assembles its own.
  async convert({
    from,
    to,
    amount,
  }: ConversionRequest): Promise<ConversionOutcome> {
    const { snapshot, source, cacheDegraded } = await this.rates.getSnapshot();
    const { strategy, rate } = this.resolver.resolve(from, to, snapshot.rates);
    const converted = roundHalfUp(
      new Money(amount).times(rate),
      RESULT_DECIMALS,
    );

    this.logger.info(
      `Converted ${from} to ${to} at the ${strategy.name} rate from ${source} rates`,
    );
    // The amount is the one part of a conversion that says something about the
    // caller rather than about the rates, so the line that is on in production
    // carries the pair and how it was priced, and this one carries the money.
    this.logger.debug(`Converted ${amount} ${from} to ${converted} ${to}`);

    const result: ConversionResult = {
      from,
      to,
      amount,
      result: converted,
      rate: roundHalfUp(rate, RATE_DECIMALS),
      strategy: strategy.name,
      source,
      ratesTimestamp: snapshot.fetchedAt,
    };

    // Awaited so a client that reads /history straight after a conversion finds
    // it there. Nothing is caught here: HistoryService.record never rejects —
    // that is the promise it exists to keep, because the conversion is the
    // answer and the record is a side effect of it (§2) — and a second guard
    // over it would only be a branch no test can reach honestly. It does report
    // whether the record landed, which is the one thing the client cannot see
    // for itself: /history will not have this conversion in it.
    const recorded = await this.history.record(result);

    return { result, cacheDegraded, recorded };
  }
}
