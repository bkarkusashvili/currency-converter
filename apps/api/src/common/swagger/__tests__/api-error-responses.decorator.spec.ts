import { Controller, Get, HttpStatus, INestApplication } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { ApiErrorResponses } from '../api-error-responses.decorator';
import { buildSwaggerConfig } from '../build-swagger-config';

@Controller('probe')
class ProbeController {
  @Get()
  @ApiErrorResponses(
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.SERVICE_UNAVAILABLE,
    // Not in the description table, to prove an undescribed status still lands
    // in the document.
    HttpStatus.GONE,
  )
  probe(): { probed: true } {
    return { probed: true };
  }
}

describe('ApiErrorResponses', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    document = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig({
        name: 'probe',
        version: '1.0.0',
        description: 'probe',
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  function responses(): Record<string, unknown> {
    return document.paths['/probe']?.get?.responses ?? {};
  }

  it.each(['422', '503', '410'])('declares a %s response', (status) => {
    expect(responses()).toHaveProperty(status);
  });

  it('declares no status it was not given', () => {
    expect(Object.keys(responses()).sort()).toStrictEqual([
      '410',
      '422',
      '503',
    ]);
  });

  it('points every one of them at the shared error envelope', () => {
    for (const status of ['422', '503', '410']) {
      expect(responses()[status]).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponseDto' },
          },
        },
      });
    }
  });

  it('registers the envelope schema by referencing it', () => {
    expect(document.components?.schemas).toHaveProperty('ErrorResponseDto');
  });

  it('describes each status so the document is readable', () => {
    expect(responses()['422']).toMatchObject({
      description: expect.stringContaining('rates') as string,
    });
    expect(responses()['410']).toMatchObject({
      description: expect.any(String) as string,
    });
  });
});
