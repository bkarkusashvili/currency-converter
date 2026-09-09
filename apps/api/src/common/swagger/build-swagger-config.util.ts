import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { API_KEY_HEADER } from '../guards';
import { PackageMetadata } from './read-package-metadata.util';

// The security scheme name routes refer to with @ApiSecurity.
export const ADMIN_SECURITY_SCHEME = 'admin';

export function buildSwaggerConfig(
  metadata: PackageMetadata,
): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle(metadata.name)
    .setDescription(metadata.description)
    .setVersion(metadata.version)
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      ADMIN_SECURITY_SCHEME,
    )
    .build();
}
