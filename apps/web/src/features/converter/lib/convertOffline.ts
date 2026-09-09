import type Big from 'big.js';
import type {
  ConversionStrategy,
  ConvertRequest,
  ExchangeRate,
  RatesSnapshotResponse,
} from '../../../api';
import { Money, RATE_DECIMALS, RESULT_DECIMALS, roundHalfUp } from './money';
import { HUB_CURRENCY } from './provenance';

/**
 * This is the server's conversion, computed in the browser, and the duplication
 * is deliberate. It exists for one case: the API is unreachable, the persisted
 * snapshot is the newest rates anyone has, and an estimate the user can see —
 * badged as an estimate, with the age of the rates next to it — is worth more
 * than an error card. It follows docs/architecture.md §5 rule for rule and
 * big.js for big.js so the number matches what the API would have answered from
 * the same snapshot; when the two ever disagree, the server is authoritative,
 * because it prices from rates this copy cannot know are already stale. Nothing
 * computed here is written to history, and §5 is the contract both sides
 * implement: a change there changes both.
 */

export interface OfflineConversion {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategy;
  /** `fetchedAt` of the snapshot the rate came from, which is how old the estimate is. */
  ratesTimestamp: string;
}

interface PricedConversion {
  rate: Big;
  strategy: ConversionStrategy;
}

export function convertOffline(
  request: ConvertRequest,
  snapshot: RatesSnapshotResponse,
): OfflineConversion | undefined {
  const from = request.from.toUpperCase();
  const to = request.to.toUpperCase();

  if (!Number.isFinite(request.amount)) {
    return undefined;
  }

  const priced = priceConversion(from, to, snapshot.rates);

  if (priced === undefined) {
    return undefined;
  }

  // The result is computed from the unrounded rate and the rate is rounded
  // separately, as the server does: rounding first would multiply a large
  // amount by an error of up to half a unit in the sixth decimal.
  return {
    from,
    to,
    amount: request.amount,
    result: roundHalfUp(new Money(request.amount).times(priced.rate), RESULT_DECIMALS),
    rate: roundHalfUp(priced.rate, RATE_DECIMALS),
    strategy: priced.strategy,
    ratesTimestamp: snapshot.fetchedAt,
  };
}

/**
 * Identity, then the published pair, then the hub — the order §5 gives, and for
 * its reasons. Membership is settled before any of them, as the server's
 * resolver does: identity prices a code against itself whatever the rates say,
 * so a chain asked first would answer `XYZ → XYZ` with 1 for a code the
 * snapshot never quotes and `/currencies` does not list, which is the row §3
 * reserves for UNSUPPORTED_CURRENCY.
 */
function priceConversion(
  from: string,
  to: string,
  rates: readonly ExchangeRate[],
): PricedConversion | undefined {
  if (!quotes(rates, from) || !quotes(rates, to)) {
    return undefined;
  }

  if (from === to) {
    return { rate: new Money(1), strategy: 'identity' };
  }

  const direct = directionalRate(from, to, rates);

  if (direct !== undefined) {
    return { rate: direct, strategy: 'direct' };
  }

  const cross = crossRate(from, to, rates);

  return cross === undefined ? undefined : { rate: cross, strategy: 'cross' };
}

/** Whether the snapshot quotes a code at all, on either side of any pair: what `GET /currencies` lists. */
function quotes(rates: readonly ExchangeRate[], code: string): boolean {
  return rates.some((rate) => rate.base === code || rate.quote === code);
}

/**
 * Monobank quotes one unit of `base` in `quote`, so `base → quote` pays what the
 * bank buys `base` at and `quote → base` pays what it sells it at, with the mid
 * rate standing in for both on the pairs published without a spread.
 */
function directionalRate(
  from: string,
  to: string,
  rates: readonly ExchangeRate[],
): Big | undefined {
  const forward = findPair(rates, from, to);
  const buy = usable(forward?.buy) ?? usable(forward?.cross);

  if (buy !== undefined) {
    return new Money(buy);
  }

  const reverse = findPair(rates, to, from);
  const sell = usable(reverse?.sell) ?? usable(reverse?.cross);

  return sell === undefined ? undefined : new Money(1).div(sell);
}

/** Two legs through the currency every published pair has in common, so the spread is paid twice. */
function crossRate(from: string, to: string, rates: readonly ExchangeRate[]): Big | undefined {
  const intoHub = directionalRate(from, HUB_CURRENCY, rates);
  const outOfHub = directionalRate(HUB_CURRENCY, to, rates);

  return intoHub === undefined || outOfHub === undefined ? undefined : intoHub.times(outOfHub);
}

function findPair(
  rates: readonly ExchangeRate[],
  base: string,
  quote: string,
): ExchangeRate | undefined {
  return rates.find((rate) => rate.base === base && rate.quote === quote);
}

/**
 * A rate a snapshot cannot be priced with. The copy in storage outlives a
 * deploy and is only checked for shape, and a zero would otherwise divide.
 */
function usable(rate: number | undefined): number | undefined {
  return rate !== undefined && rate > 0 ? rate : undefined;
}
