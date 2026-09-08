import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { DOCS_JSON_PATH, DOCS_PATH } from '../../configure-http';
import { ErrorResponseDto } from '../filters/error-response.dto';
import { buildSwaggerConfig } from './build-swagger-config';
import { readPackageMetadata } from './read-package-metadata';

// Shared by main.ts and the e2e document test, so the document under test is
// the one the process serves rather than a second one assembled beside it.
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    buildSwaggerConfig(readPackageMetadata()),
    // The envelope is registered up front rather than only through the routes
    // that reference it, so components.schemas describes it from the first
    // route onwards.
    { extraModels: [ErrorResponseDto] },
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: DOCS_JSON_PATH,
  });
}
