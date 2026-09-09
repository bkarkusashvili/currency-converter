import { API_KEY_HEADER } from '../../guards/api-key.guard';
import {
  ADMIN_SECURITY_SCHEME,
  buildSwaggerConfig,
} from '../build-swagger-config.util';

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

  it('offers the admin api key so the guarded routes can be tried from /docs', () => {
    expect(
      config.components?.securitySchemes?.[ADMIN_SECURITY_SCHEME],
    ).toStrictEqual({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' });
  });
});
