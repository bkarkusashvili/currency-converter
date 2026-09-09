import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { API_KEY_HEADER } from '../../src/common/guards/api-key.guard';
import { ADMIN_SECURITY_SCHEME } from '../../src/common/swagger/build-swagger-config.util';
import { WarningCode } from '../../src/common/warnings/warning-code.enum';
import { ConversionStrategyName } from '../../src/common/conversion/conversion-strategy-name.enum';
import { RatesSource } from '../../src/modules/rates/domain/rates-source.enum';
import { createE2eApp } from './create-e2e-app';

// Every route the API serves, with the method it answers. A route that is
// added without reaching the document fails here, which is the point: later
// PRs extend this list as they add routes.
const EXPECTED_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['/health', 'get'],
  ['/health/live', 'get'],
  ['/api/v1/rates', 'get'],
  ['/api/v1/convert', 'post'],
  ['/api/v1/rates/cache', 'delete'],
  ['/api/v1/currencies', 'get'],
  ['/api/v1/history', 'get'],
];

// Every schema the document has to describe by name.
const EXPECTED_SCHEMAS: readonly string[] = [
  'ErrorResponseDto',
  'ExchangeRateDto',
  'RatesSnapshotResponseDto',
  'CurrencyDto',
  'CurrenciesResponseDto',
  'ConvertRequestDto',
  'ConvertResponseDto',
  'ResponseWarningDto',
  'ConversionRecordDto',
  'HistoryResponseDto',
];

describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createE2eApp({ imports: [AppModule] }, { withSwagger: true });

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;

    const response = await request(server).get('/docs-json').expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI', async () => {
    const response = await request(server).get('/docs').expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });

  it('titles and versions the document from the package metadata', () => {
    expect(document.info).toMatchObject({
      title: 'currency-converter-api',
      version: expect.stringMatching(/^\d+\.\d+\.\d+/) as string,
    });
  });

  it.each(EXPECTED_PATHS)('documents %s %s', (path, method) => {
    expect(document.paths[path]).toBeDefined();
    expect(document.paths[path]).toHaveProperty(method);
  });

  it('documents no route that the API does not serve', () => {
    const documented = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method} ${path}`),
    );

    expect(documented.sort()).toStrictEqual(
      EXPECTED_PATHS.map(([path, method]) => `${method} ${path}`).sort(),
    );
  });

  it.each(EXPECTED_SCHEMAS)('describes the %s schema', (schema) => {
    expect(document.components?.schemas).toHaveProperty(schema);
  });

  it('describes every field of the error envelope', () => {
    const envelope = document.components?.schemas?.ErrorResponseDto;

    expect(envelope).toMatchObject({
      properties: {
        statusCode: { example: 422 },
        code: { example: 'UNSUPPORTED_CURRENCY' },
        message: expect.any(Object) as object,
        details: expect.any(Object) as object,
        timestamp: expect.any(Object) as object,
        path: expect.any(Object) as object,
        requestId: expect.any(Object) as object,
      },
      required: expect.arrayContaining([
        'statusCode',
        'code',
        'message',
        'timestamp',
        'path',
      ]) as string[],
    });
  });

  it('offers the admin api key as a security scheme', () => {
    expect(
      document.components?.securitySchemes?.[ADMIN_SECURITY_SCHEME],
    ).toStrictEqual({
      type: 'apiKey',
      name: API_KEY_HEADER,
      in: 'header',
    });
  });

  it('summarises the health route', () => {
    expect(document.paths['/health']?.get?.summary).toEqual(expect.any(String));
  });

  it('enumerates the sources a snapshot can be served from', () => {
    expect(
      document.components?.schemas?.RatesSnapshotResponseDto,
    ).toMatchObject({
      properties: {
        source: { type: 'string', enum: Object.values(RatesSource) },
      },
    });
  });

  it('declares every failure the rates lookup can answer with', () => {
    expect(
      Object.keys(document.paths['/api/v1/rates']?.get?.responses ?? {}).sort(),
    ).toStrictEqual(['200', '429', '500', '503']);
  });

  it('enumerates the strategies a conversion can be priced with', () => {
    expect(document.components?.schemas?.ConvertResponseDto).toMatchObject({
      properties: {
        strategy: {
          type: 'string',
          enum: Object.values(ConversionStrategyName),
        },
        source: { type: 'string', enum: Object.values(RatesSource) },
      },
    });
  });

  // The codes are the contract a client switches on, so a warning added
  // without reaching the document is a warning nothing can be written against.
  it('enumerates the degradations a response can report', () => {
    expect(document.components?.schemas?.ResponseWarningDto).toMatchObject({
      properties: {
        code: { type: 'string', enum: Object.values(WarningCode) },
      },
      required: ['code', 'message'],
    });
  });

  it('describes the warnings as an optional array on every route that reads a snapshot', () => {
    for (const schema of [
      'ConvertResponseDto',
      'RatesSnapshotResponseDto',
      'CurrenciesResponseDto',
    ]) {
      expect(document.components?.schemas?.[schema]).toMatchObject({
        properties: {
          warnings: {
            type: 'array',
            items: { $ref: '#/components/schemas/ResponseWarningDto' },
          },
        },
      });
      expect(
        (document.components?.schemas?.[schema] as { required: string[] })
          .required,
      ).not.toContain('warnings');
    }
  });

  it('declares every failure a conversion can answer with', () => {
    expect(
      Object.keys(
        document.paths['/api/v1/convert']?.post?.responses ?? {},
      ).sort(),
    ).toStrictEqual(['200', '400', '422', '429', '500', '503']);
  });

  it('constrains the convert request body in the document', () => {
    expect(document.components?.schemas?.ConvertRequestDto).toMatchObject({
      properties: {
        from: { minLength: 3, maxLength: 3, pattern: '^[A-Za-z]{3}$' },
        amount: { minimum: 0, exclusiveMinimum: true, maximum: 1000000000000 },
      },
      required: ['from', 'to', 'amount'],
    });
  });

  it('declares every failure the history can answer with', () => {
    expect(
      Object.keys(
        document.paths['/api/v1/history']?.get?.responses ?? {},
      ).sort(),
    ).toStrictEqual(['200', '400', '429', '500', '503']);
  });

  // The bounds are the contract a client writes its paging against, and they
  // only exist in the document if the DTO carries them.
  it('documents the history page size with its bounds and default', () => {
    const [limit] = document.paths['/api/v1/history']?.get?.parameters ?? [];

    expect(limit).toMatchObject({
      name: 'limit',
      in: 'query',
      required: false,
      schema: { minimum: 1, maximum: 50, default: 10 },
    });
  });

  it('describes a recorded conversion with the provenance it was priced from', () => {
    expect(document.components?.schemas?.ConversionRecordDto).toMatchObject({
      properties: {
        strategy: {
          type: 'string',
          enum: Object.values(ConversionStrategyName),
        },
        source: { type: 'string', enum: Object.values(RatesSource) },
      },
    });
  });

  // The exact set, not a subset: the record is the conversion that was answered
  // plus the two fields the store owns, and it declares those ten properties
  // itself rather than inheriting them. A field that stops being published, or
  // one that arrives from somewhere, fails here either way — `warnings` in
  // particular, which is a fact about a request rather than about what was
  // converted and which the store has never had a column for.
  it('publishes exactly the ten fields of a stored conversion', () => {
    const record = document.components?.schemas?.ConversionRecordDto as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect([...record.required].sort()).toStrictEqual([
      'amount',
      'createdAt',
      'from',
      'id',
      'rate',
      'ratesTimestamp',
      'result',
      'source',
      'strategy',
      'to',
    ]);
    expect(Object.keys(record.properties).sort()).toStrictEqual(
      [...record.required].sort(),
    );
  });

  it('puts the cache invalidation behind the admin key scheme', () => {
    const invalidate = document.paths['/api/v1/rates/cache']?.delete;

    expect(invalidate?.security).toStrictEqual([
      { [ADMIN_SECURITY_SCHEME]: [] },
    ]);
    expect(Object.keys(invalidate?.responses ?? {}).sort()).toStrictEqual([
      '204',
      '401',
      '429',
      '500',
      '503',
    ]);
  });
});
