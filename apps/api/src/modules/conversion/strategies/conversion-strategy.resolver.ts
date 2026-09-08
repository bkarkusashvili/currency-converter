import { Inject, Injectable } from '@nestjs/common';
import { RateNotAvailableError } from '../../../common/errors/rate-not-available.error';
import { UnsupportedCurrencyError } from '../../../common/errors/unsupported-currency.error';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategy } from './conversion-strategy';
import { CONVERSION_STRATEGIES } from './conversion-strategies.token';

// Whether the snapshot quotes a code at all, on either side of any pair. It is
// the same question `GET /currencies` answers, so a code this says no to is one
// the client could not have found listed.
function quotes(rates: readonly ExchangeRate[], code: CurrencyCode): boolean {
  return rates.some((rate) => rate.base === code || rate.quote === code);
}

// The two ways a conversion can have no answer are different reports, and §3
// gives them different codes. A code the snapshot never mentions is the
// client's: it asked for something this API cannot quote, and retrying will not
// help. Two codes it does mention with no path between them is the rates':
// nothing is wrong with the request, the snapshot is simply thin today.
//
// `from` is checked first so that when neither is known the message points at
// the field a caller would fix first.
function requireQuoted(
  rates: readonly ExchangeRate[],
  code: CurrencyCode,
): void {
  if (!quotes(rates, code)) {
    throw new UnsupportedCurrencyError(code);
  }
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

  // Membership is settled before the chain runs rather than inferred from it
  // failing. `IdentityStrategy` prices any code against itself — that is its
  // contract and the rates cannot change it — so a chain asked first would
  // answer `XYZ → XYZ` with rate 1 for a code the snapshot never quotes and
  // `/currencies` does not list, which is the row §3 reserves for
  // `UNSUPPORTED_CURRENCY`. Checking here keeps each strategy ignorant of what
  // the API supports and leaves one meaning for a chain that finds nothing:
  // both codes are quoted and there is no path between them.
  resolve(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): ConversionStrategy {
    requireQuoted(rates, from);
    requireQuoted(rates, to);

    const strategy = this.strategies.find((candidate) =>
      candidate.supports(from, to, rates),
    );

    if (strategy === undefined) {
      throw new RateNotAvailableError(from, to);
    }

    return strategy;
  }
}
