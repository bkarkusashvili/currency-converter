import {
  generateOpenApiDocument,
  readCommittedOpenApiDocument,
  WRITE_COMMAND,
} from '../openapi-document';

// docs/openapi.json is the published contract, and the web app hand-maintains
// its own copy of these types against it. Committing the document is what makes
// a change to the surface show up in a diff rather than only in a running
// process — and it is what the web suite validates its own fixtures against, so
// a client type that drifts from the API fails there.
describe('the committed OpenAPI document (e2e)', () => {
  it('matches the document the application generates', async () => {
    const generated = await generateOpenApiDocument();

    // A bare toBe on a thousand-line string is unreadable when it fails, so
    // the instruction comes first and the diff second.
    if (readCommittedOpenApiDocument() !== generated) {
      throw new Error(
        `docs/openapi.json is out of date with the application's decorators. ` +
          `Run \`${WRITE_COMMAND}\` and commit the result.`,
      );
    }

    expect(readCommittedOpenApiDocument()).toBe(generated);
  }, 30_000);
});
