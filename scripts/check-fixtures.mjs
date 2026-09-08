// The shared golden fixtures are the one place the API's conversion suite and
// the web app's offline estimate agree on their inputs, and they are plain JSON
// so both can read them without a build step. Nothing type-checks JSON, so this
// does: both files parse, both have the shape their readers expect, and every
// currency a vector names is one the snapshot actually quotes — which is the
// mistake that would otherwise show up as eight identical "no rate" failures in
// two suites at once.
//
// Deliberately dependency-free: the root package is a task runner, not an app.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const STRATEGIES = ['identity', 'direct', 'cross'];
const RATE_DECIMALS = 6;
const RESULT_DECIMALS = 2;

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

const snapshot = read('rates-snapshot.json');
const golden = read('golden-conversions.json');

if (snapshot !== null && golden !== null) {
  checkVectors(golden, checkSnapshot(snapshot));
}

if (problems.length > 0) {
  console.error('The shared fixtures are not consistent:\n');

  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log(
  `fixtures ok: ${snapshot.rates.length} published pairs, ${golden.vectors.length} golden vectors`,
);
