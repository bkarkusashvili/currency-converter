import { INestApplication } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DOCS_JSON_PATH, DOCS_PATH } from '../http';
import { ErrorResponseDto } from '../filters';
import { buildSwaggerConfig } from './build-swagger-config.util';
import { readPackageMetadata } from './read-package-metadata.util';

// The document itself, separate from serving it: the e2e contract test and the
// `openapi:write` script both need the document without a route to fetch it
// from, and it must be the one the process serves rather than a second one
// assembled beside it.
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    buildSwaggerConfig(readPackageMetadata()),
    // The envelope is registered up front rather than only through the routes
    // that reference it, so components.schemas describes it from the first
    // route onwards.
    { extraModels: [ErrorResponseDto] },
  );
}

// Shared by main.ts and the e2e document test, so the document under test is
// the one the process serves rather than a second one assembled beside it.
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: DOCS_JSON_PATH,
  });
}
