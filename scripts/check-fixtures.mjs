// The shared golden fixtures are the one place the API's conversion suite and
// the web app's offline estimate agree on their inputs, and they are plain JSON
// so both can read them without a build step. Nothing type-checks JSON, so this
// does: both files parse, both have the shape their readers expect, and every
// currency a vector names is one the snapshot actually quotes — which is the
// mistake that would otherwise show up as eight identical "no rate" failures in
// two suites at once.
//
// Then it re-prices every vector from the snapshot, applying docs/architecture.md
// §5 a third time. Without that the twelve hand-computed rows are the single
// source of truth for both implementations: a transcription slip in the table
// is a rule both suites would agree on and both would have wrong. This is a
// third derivation of the same rule rather than a copy of either — the two
// implementations use big.js, and the arithmetic below is exact integers — so a
// disagreement means one of the three is wrong rather than that a shared
// library moved.
//
// Deliberately dependency-free: the root package is a task runner, not an app.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const STRATEGIES = ['identity', 'direct', 'cross'];
const RATE_DECIMALS = 6;
const RESULT_DECIMALS = 2;
// The currency every published pair has in common, which for a Ukrainian bank's
// rates is the hryvnia: BASE_CURRENCY in the API, HUB_CURRENCY in the web app.
const BASE_CURRENCY = 'UAH';
// `Money.DP` in apps/api/src/common/money/money.ts and its web counterpart: how
// far a reciprocal is carried before anything is published to six decimals.
const DIVISION_DECIMALS = 30;

const problems = [];

function fail(message) {
  problems.push(message);
}

function read(name) {
  const path = join(FIXTURES, name);

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${name} does not parse: ${error.message}`);

    return null;
  }
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isCode(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function decimals(value) {
  const [, fraction = ''] = String(value).split('.');

  return fraction.length;
}

function checkSnapshot(snapshot) {
  const quoted = new Set();

  if (!isIsoTimestamp(snapshot?.fetchedAt)) {
    fail('rates-snapshot.json: fetchedAt is not an ISO timestamp');
  }

  if (!Array.isArray(snapshot?.rates) || snapshot.rates.length === 0) {
    fail('rates-snapshot.json: rates must be a non-empty array');

    return quoted;
  }

  snapshot.rates.forEach((rate, index) => {
    const at = `rates-snapshot.json: rates[${index}]`;

    if (!isCode(rate.base) || !isCode(rate.quote)) {
      fail(`${at} has a base or quote that is not a three-letter code`);

      return;
    }

    quoted.add(rate.base).add(rate.quote);

    if (!isIsoTimestamp(rate.date)) {
      fail(`${at} (${rate.base}/${rate.quote}) has no ISO date`);
    }

    // A pair is quoted with a spread or with a mid rate, never with neither:
    // the second is what a snapshot that cannot price anything looks like.
    const priced = ['buy', 'sell', 'cross'].filter((key) => rate[key] !== undefined);

    if (priced.length === 0) {
      fail(`${at} (${rate.base}/${rate.quote}) carries no buy, sell or cross rate`);
    }

    for (const key of priced) {
      if (typeof rate[key] !== 'number' || !(rate[key] > 0)) {
        fail(`${at} (${rate.base}/${rate.quote}) has a ${key} that is not a positive number`);
      }
    }
  });

  return quoted;
}

function checkVectors(golden, quoted) {
  if (!Array.isArray(golden?.vectors) || golden.vectors.length < 8) {
    fail('golden-conversions.json: vectors must be an array of at least eight entries');

    return;
  }

  const seen = new Set();

  golden.vectors.forEach((vector, index) => {
    const at = `golden-conversions.json: vectors[${index}]`;

    for (const side of ['from', 'to']) {
      if (!isCode(vector[side])) {
        fail(`${at} has a ${side} that is not a three-letter code`);
      } else if (!quoted.has(vector[side])) {
        // The whole point of the cross-reference: a vector against a currency
        // the snapshot does not quote can only ever assert a failure.
        fail(`${at} converts ${side} ${vector[side]}, which rates-snapshot.json does not quote`);
      }
    }

    const key = `${vector.from}->${vector.to}@${vector.amount}`;

    if (seen.has(key)) {
      fail(`${at} repeats ${key}`);
    }

    seen.add(key);

    if (typeof vector.amount !== 'number' || !(vector.amount > 0)) {
      fail(`${at} has an amount that is not a positive number`);
    }

    if (typeof vector.rate !== 'number' || !(vector.rate > 0)) {
      fail(`${at} has a rate that is not a positive number`);
    } else if (decimals(vector.rate) > RATE_DECIMALS) {
      fail(`${at} publishes a rate to more than ${RATE_DECIMALS} decimals`);
    }

    if (typeof vector.result !== 'number' || vector.result < 0) {
      fail(`${at} has a result that is not a number at or above zero`);
    } else if (decimals(vector.result) > RESULT_DECIMALS) {
      fail(`${at} publishes a result to more than ${RESULT_DECIMALS} decimals`);
    }

    if (!STRATEGIES.includes(vector.strategy)) {
      fail(`${at} names the strategy ${String(vector.strategy)}, which is not one of ${STRATEGIES.join(', ')}`);
    }

    if (vector.strategy === 'identity' && vector.from !== vector.to) {
      fail(`${at} is priced as identity but converts ${vector.from} to ${vector.to}`);
    }

    if (vector.strategy !== 'identity' && vector.from === vector.to) {
      fail(`${at} converts ${vector.from} to itself and is not priced as identity`);
    }
  });
}

// ---------------------------------------------------------------------------
// Exact decimals, in integers
//
// §5 is a rule about money, so the re-pricing below cannot be done in floats:
// 1 / 12.1834 in binary is not the number either implementation divides to, and
// the million-hryvnia vector exists precisely because a rounding order that is
// half a unit out in the sixth decimal is visible in the result. A value here
// is `units / 10 ** scale` held as a BigInt, which is exact; multiplication
// keeps every digit and division rounds half-up at DIVISION_DECIMALS places,
// which is what big.js does with `DP = 30` and `RM = roundHalfUp`.
//
// Every value on this path is positive — checkSnapshot rejects a rate that is
// not, and checkVectors an amount that is not — so a truncating BigInt division
// and a doubled remainder are all half-up needs.
// ---------------------------------------------------------------------------

const ONE = { units: 1n, scale: 0 };

function power(exponent) {
  return 10n ** BigInt(exponent);
}

// Read the way big.js reads a number: through `String`, which gives the shortest
// decimal that round-trips — the literal the JSON was written with.
function parseDecimal(value) {
  const match = /^(-?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value));

  if (match === null || (match[2] === '' && (match[3] ?? '') === '')) {
    return undefined;
  }

  const [, sign, whole, fraction = '', exponent = '0'] = match;
  const units = BigInt(`${whole === '' ? '0' : whole}${fraction}`);
  const scale = fraction.length - Number(exponent);

  return scale < 0
    ? { units: (sign === '-' ? -units : units) * power(-scale), scale: 0 }
    : { units: sign === '-' ? -units : units, scale };
}

function quotientHalfUp(numerator, denominator) {
  const quotient = numerator / denominator;

  return 2n * (numerator - quotient * denominator) >= denominator ? quotient + 1n : quotient;
}

/** Exact: every digit of the product is kept, as big.js `times` does. */
function times(first, second) {
  return { units: first.units * second.units, scale: first.scale + second.scale };
}

/** Rounded half-up at DIVISION_DECIMALS places, as `Money.div` is. */
function divide(first, second) {
  return {
    units: quotientHalfUp(
      first.units * power(second.scale + DIVISION_DECIMALS),
      second.units * power(first.scale),
    ),
    scale: DIVISION_DECIMALS,
  };
}

/** Half away from zero to `places`, then out as the JSON number it is published as. */
function roundToNumber(value, places) {
  const scaled = quotientHalfUp(value.units * power(places), power(value.scale));
  const digits = scaled.toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);

  return Number(places === 0 ? whole : `${whole}.${digits.slice(digits.length - places)}`);
}

// ---------------------------------------------------------------------------
// docs/architecture.md §5, once more
// ---------------------------------------------------------------------------

function findPair(rates, base, quote) {
  return rates.find((rate) => rate.base === base && rate.quote === quote);
}

/** A rate a snapshot cannot be priced with; a zero would otherwise divide. */
function usable(rate) {
  return typeof rate === 'number' && rate > 0 ? parseDecimal(rate) : undefined;
}

/**
 * The §5 direction table: `base → quote` pays what the bank buys the base at,
 * `quote → base` pays one over what it sells the base at, and the mid rate
 * stands in for both on the pairs published without a spread.
 */
function directionalRate(from, to, rates) {
  const forward = findPair(rates, from, to);
  const buy = usable(forward?.buy) ?? usable(forward?.cross);

  if (buy !== undefined) {
    return buy;
  }

  const reverse = findPair(rates, to, from);
  const sell = usable(reverse?.sell) ?? usable(reverse?.cross);

  return sell === undefined ? undefined : divide(ONE, sell);
}

/** Identity, then the published pair, then two legs through the base currency. */
function price(from, to, rates) {
  if (from === to) {
    return { strategy: 'identity', rate: ONE };
  }

  const direct = directionalRate(from, to, rates);

  if (direct !== undefined) {
    return { strategy: 'direct', rate: direct };
  }

  const intoBase = directionalRate(from, BASE_CURRENCY, rates);
  const outOfBase = directionalRate(BASE_CURRENCY, to, rates);

  return intoBase === undefined || outOfBase === undefined
    ? undefined
    : { strategy: 'cross', rate: times(intoBase, outOfBase) };
}

function repriceVectors(golden, snapshot) {
  golden.vectors.forEach((vector, index) => {
    const at = `golden-conversions.json: vectors[${index}] (${vector.amount} ${vector.from} -> ${vector.to})`;
    const amount = parseDecimal(vector.amount);
    const priced = price(vector.from, vector.to, snapshot.rates);

    if (priced === undefined) {
      fail(`${at} cannot be priced from rates-snapshot.json by any strategy`);

      return;
    }

    if (priced.strategy !== vector.strategy) {
      fail(`${at} is published as ${vector.strategy}, but §5 prices it as ${priced.strategy}`);
    }

    const rate = roundToNumber(priced.rate, RATE_DECIMALS);

    if (rate !== vector.rate) {
      fail(`${at} publishes rate ${vector.rate}, but §5 gives ${rate}`);
    }

    // From the *unrounded* rate, which is the half of §5 the million-hryvnia
    // vector exists to pin: times the published six decimals it would be
    // 82079.00 rather than 82078.89.
    const result = roundToNumber(times(amount, priced.rate), RESULT_DECIMALS);

    if (result !== vector.result) {
      fail(`${at} publishes result ${vector.result}, but §5 gives ${result}`);
    }
  });
}

const snapshot = read('rates-snapshot.json');
const golden = read('golden-conversions.json');

if (snapshot !== null && golden !== null) {
  checkVectors(golden, checkSnapshot(snapshot));

  // Only once the shapes hold: re-pricing a malformed table would bury the one
  // problem that has to be read first under twelve derived ones — and it is
  // that pass which has already established every amount is a positive JSON
  // number, which is the only kind `parseDecimal` is asked to read.
  if (problems.length === 0) {
    repriceVectors(golden, snapshot);
  }
}

if (problems.length > 0) {
  console.error('The shared fixtures are not consistent:\n');

  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log(
  `fixtures ok: ${snapshot.rates.length} published pairs, ${golden.vectors.length} golden vectors re-priced from §5`,
);
