// The environment has to be in place before app.module.ts is imported, because
// ConfigModule.forRoot reads process.env while it is: this import must stay
// first.
import './e2e/setup-e2e-env';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/common/swagger/setup-swagger.util';
import { createE2eApp } from './e2e/create-e2e-app';

// The published contract, committed so a change to it shows up in a diff. The
// web app hand-maintains its own copy of these DTOs, and the only thing that
// used to check the two agreed was a person reading both.
export const OPENAPI_DOCUMENT_PATH = join(
  __dirname,
  '../../../docs/openapi.json',
);

export const WRITE_COMMAND = 'npm --prefix apps/api run openapi:write';

// Sorted, so the file is a diff of what changed rather than of whatever order
// the decorators were evaluated in. Arrays keep their order — `required` and
// the enums are lists the contract states, not sets.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, sortKeys(entry)]),
  );
}

export function serializeOpenApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(sortKeys(document), null, 2)}\n`;
}

// Boots the app exactly as the e2e suite does — every out-of-process
// dependency swapped out — so generating the document needs no Redis, no Mongo
// and no network.
export async function generateOpenApiDocument(): Promise<string> {
  const app = await createE2eApp({ imports: [AppModule] });

  try {
    return serializeOpenApiDocument(buildOpenApiDocument(app));
  } finally {
    await app.close();
  }
}

export function readCommittedOpenApiDocument(): string {
  return readFileSync(OPENAPI_DOCUMENT_PATH, 'utf8');
}
