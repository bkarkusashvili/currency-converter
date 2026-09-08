import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';
import { createFakeRepositories, FAKE_RESPONSES } from '../../test/fakes/createFakeRepositories';

/**
 * `api/types.ts` is a hand-written mirror of the API's DTOs, and until now
 * nothing checked that it still matched: the API publishes its OpenAPI
 * document, the client re-declares the same shapes, and the two could part
 * without a single test noticing.
 *
 * So every sample response this suite renders is validated against the schema
 * the committed contract publishes for its route. It is deliberately narrow —
 * it does not typecheck `types.ts` against the document, it checks that the
 * bodies the fakes hand the app are bodies the API could actually have sent.
 * A field the API renamed, dropped or made required fails here.
 */
const DOCUMENT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../docs/openapi.json',
);

/** JSON Pointer escaping, so a path with slashes can name an inline schema. */
function pointer(...segments: string[]): string {
  return segments.map((segment) => segment.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

const SCHEMA_REFS = {
  convert: `contract#/components/schemas/ConvertResponseDto`,
  currencies: `contract#/components/schemas/CurrenciesResponseDto`,
  rates: `contract#/components/schemas/RatesSnapshotResponseDto`,
  history: `contract#/components/schemas/HistoryResponseDto`,
  // Terminus documents the report inline on the route rather than as a named
  // component, so this one is addressed by pointer.
  health: `contract#/${pointer(
    'paths',
    '/health',
    'get',
    'responses',
    '200',
    'content',
    'application/json',
    'schema',
  )}`,
} as const;

type Route = keyof typeof SCHEMA_REFS;

let validators: Record<Route, ValidateFunction>;

function check(route: Route, body: unknown): void {
  const validate = validators[route];

  if (!validate(body)) {
    throw new Error(
      `The ${route} fixture does not match docs/openapi.json:\n` +
        (validate.errors ?? [])
          .map((error) => `  ${error.instancePath || '/'} ${error.message ?? ''}`)
          .join('\n'),
    );
  }

  expect(validate.errors).toBeNull();
}

beforeAll(() => {
  const document: unknown = JSON.parse(readFileSync(DOCUMENT_PATH, 'utf8'));

  // OpenAPI 3.0 is not quite JSON Schema — `nullable`, `example` and a boolean
  // `exclusiveMinimum` are all things a draft-07 validator does not know — so
  // the meta-schema check is off and unknown keywords are ignored. What is
  // being checked is `type`, `required`, `enum` and `$ref`, which is where a
  // client type drifts.
  const ajv = new Ajv({ strict: false, validateSchema: false, allErrors: true });

  ajv.addSchema({ ...(document as object), $id: 'contract' });

  validators = Object.fromEntries(
    Object.entries(SCHEMA_REFS).map(([route, ref]) => [route, ajv.compile({ $ref: ref })]),
  ) as Record<Route, ValidateFunction>;
});

describe('the fixtures this suite renders against the published contract', () => {
  it.each(Object.keys(SCHEMA_REFS) as Route[])('accepts the %s sample response', (route) => {
    check(route, FAKE_RESPONSES[route]);
  });

  // The fakes answer with an empty page unless a test says otherwise, and an
  // empty page still has to be one the API could have sent — `warnings` absent
  // rather than empty, `details` present on a health report.
  it('accepts the empty answers the fakes default to', async () => {
    const { repositories } = createFakeRepositories();

    check('currencies', await repositories.currencies.list());
    check('rates', await repositories.rates.getSnapshot());
    check('history', await repositories.history.recent(10));
    check('health', await repositories.health.report());
  });

  // The check is only worth having if it can fail.
  it('rejects a response whose field the API does not publish', () => {
    expect(() => check('convert', { ...FAKE_RESPONSES.convert, strategy: 'triangular' })).toThrow(
      /strategy/,
    );
    expect(() => {
      const withoutRate: Record<string, unknown> = { ...FAKE_RESPONSES.convert };
      delete withoutRate.rate;

      check('convert', withoutRate);
    }).toThrow(/rate/);
  });
});
