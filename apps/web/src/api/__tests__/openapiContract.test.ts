import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ValidateFunction } from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';
import { createFakeServices, FAKE_RESPONSES } from '../../test/fakes/createFakeServices';

/**
 * `api/types.ts` is a hand-written mirror of the API's DTOs, and until now
 * nothing checked that it still matched: the API publishes its OpenAPI
 * document, the client re-declares the same shapes, and the two could part
 * without a single test noticing.
 *
 * So every sample response the component suites render — they build their
 * fixtures by spreading `FAKE_RESPONSES` — is validated against the schema the
 * committed contract publishes for its route. It is deliberately narrow: it
 * does not typecheck `types.ts` against the document, it checks that the
 * bodies the fakes hand the app are bodies the API could actually have sent.
 *
 * What that catches is a required field the API dropped or added, a value
 * outside an enum, and a wrong type. What it cannot catch is a field this
 * client invented: the document sets `additionalProperties: false` nowhere, so
 * a key the API never publishes validates. The health route has no `required`
 * at all, which is why its case asserts the keys it reads as well.
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

describe('the fixtures the component suites render, against the published contract', () => {
  it.each(Object.keys(SCHEMA_REFS) as Route[])('accepts the %s sample response', (route) => {
    check(route, FAKE_RESPONSES[route]);
  });

  // The fakes answer with an empty page unless a test says otherwise, and an
  // empty page still has to be one the API could have sent — `warnings` absent
  // rather than empty, `details` present on a health report.
  it('accepts the empty answers the fakes default to', async () => {
    const { services } = createFakeServices();

    check('currencies', await services.currencies.list());
    check('rates', await services.rates.getSnapshot());
    check('history', await services.history.recent(10));
    check('health', await services.health.report());
  });

  /**
   * Terminus documents its report inline on the route and gives it no
   * `required`, so the schema on its own is satisfied by `{}` — which is what
   * would make this route's case vacuous. The two keys `HealthStatus` reads
   * are asserted here beside it.
   */
  it('carries the health keys the page reads, which the schema does not require', () => {
    check('health', FAKE_RESPONSES.health);

    // `status` decides the headline and `details` is the list, so a report
    // missing either renders nothing at all.
    expect(Object.keys(FAKE_RESPONSES.health)).toContain('status');
    expect(Object.keys(FAKE_RESPONSES.health)).toContain('details');
    expect(typeof FAKE_RESPONSES.health.status).toBe('string');
    expect(Object.keys(FAKE_RESPONSES.health.details)).not.toHaveLength(0);
    // The reason the two assertions above are the substance of this case.
    expect(() => check('health', {})).not.toThrow();
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
