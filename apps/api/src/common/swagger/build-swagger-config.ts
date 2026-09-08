import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { PackageMetadata } from './read-package-metadata';

export function buildSwaggerConfig(
  metadata: PackageMetadata,
): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle(metadata.name)
    .setDescription(metadata.description)
    .setVersion(metadata.version)
    .build();
}
