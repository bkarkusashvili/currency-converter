import { buildSwaggerConfig } from '../build-swagger-config';

describe('buildSwaggerConfig', () => {
  const config = buildSwaggerConfig({
    name: 'currency-converter-api',
    version: '1.2.3',
    description: 'Converts money.',
  });

  it('titles and versions the document from the package metadata', () => {
    expect(config.info).toMatchObject({
      title: 'currency-converter-api',
      version: '1.2.3',
      description: 'Converts money.',
    });
  });

  it('produces a document without paths, which Swagger fills in from the routes', () => {
    expect(config).not.toHaveProperty('paths');
  });
});
