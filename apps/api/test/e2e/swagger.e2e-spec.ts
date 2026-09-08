import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { API_KEY_HEADER } from '../../src/common/guards/api-key.constant';
import { ADMIN_SECURITY_SCHEME } from '../../src/common/swagger/build-swagger-config';
import { RATES_SOURCES } from '../../src/modules/rates/domain/rates-source';
import { createE2eApp } from './create-e2e-app';

// Every route the API serves, with the method it answers. A route that is
// added without reaching the document fails here, which is the point: later
// PRs extend this list as they add routes.
const EXPECTED_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['/health', 'get'],
  ['/api/v1/rates', 'get'],
  ['/api/v1/rates/cache', 'delete'],
  ['/api/v1/currencies', 'get'],
];

// Every schema the document has to describe by name.
const EXPECTED_SCHEMAS: readonly string[] = [
  'ErrorResponseDto',
  'ExchangeRateDto',
  'RatesSnapshotResponseDto',
  'CurrencyDto',
  'CurrenciesResponseDto',
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
        source: { type: 'string', enum: [...RATES_SOURCES] },
      },
    });
  });

  it('declares every failure the rates lookup can answer with', () => {
    expect(
      Object.keys(document.paths['/api/v1/rates']?.get?.responses ?? {}).sort(),
    ).toStrictEqual(['200', '429', '500', '503']);
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
    ]);
  });
});
