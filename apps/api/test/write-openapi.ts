// `npm run openapi:write`. Regenerates docs/openapi.json from the running
// application's decorators; the e2e contract test fails until it has been run
// for a change that moves the published surface.
import { writeFileSync } from 'node:fs';
import {
  generateOpenApiDocument,
  OPENAPI_DOCUMENT_PATH,
} from './openapi-document';

async function main(): Promise<void> {
  writeFileSync(OPENAPI_DOCUMENT_PATH, await generateOpenApiDocument());
  console.log(`Wrote ${OPENAPI_DOCUMENT_PATH}`);
}

void main();
