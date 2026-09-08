import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error';
import { RateNotAvailableError } from '../../../common/errors/rate-not-available.error';
import { UnsupportedCurrencyError } from '../../../common/errors/unsupported-currency.error';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategy } from './conversion-strategy';
import { CONVERSION_STRATEGIES } from './conversion-strategies.token';

function mentions(code: CurrencyCode, rates: readonly ExchangeRate[]): boolean {
  return rates.some((rate) => rate.base === code || rate.quote === code);
}

// The two ways a conversion can have no answer are different reports, and §3
// gives them different codes. A code the snapshot never mentions is the
// client's: it asked for something this API cannot quote, and retrying will not
// help. Two codes it does mention with no path between them is the rates':
// nothing is wrong with the request, the snapshot is simply thin today.
//
// `from` is named first when neither is known, so the message points at the
// field a caller would fix first rather than at whichever check ran first.
function describeFailure(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: readonly ExchangeRate[],
): AppError {
  if (!mentions(from, rates)) {
    return new UnsupportedCurrencyError(from);
  }

  if (!mentions(to, rates)) {
    return new UnsupportedCurrencyError(to);
  }

  return new RateNotAvailableError(from, to);
}

// The strategies arrive as an ordered list through the token, so which ways of
// pricing exist and which is preferred are both the module's declaration and
// neither is a branch here. Adding one is adding it there.
@Injectable()
export class ConversionStrategyResolver {
  constructor(
    @Inject(CONVERSION_STRATEGIES)
    private readonly strategies: readonly ConversionStrategy[],
  ) {}

  resolve(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): ConversionStrategy {
    const strategy = this.strategies.find((candidate) =>
      candidate.supports(from, to, rates),
    );

    if (strategy === undefined) {
      throw describeFailure(from, to, rates);
    }

    return strategy;
  }
}
