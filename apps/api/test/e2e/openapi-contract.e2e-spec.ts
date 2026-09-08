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
    const committed = readCommittedOpenApiDocument();

    // What to do about it is logged rather than thrown, so the `expect` below
    // is what fails: throwing first would replace Jest's diff of the two
    // documents — the only thing that says *what* drifted — with a sentence.
    if (committed !== generated) {
      console.error(
        `docs/openapi.json is out of date with the application's decorators. ` +
          `Run \`${WRITE_COMMAND}\` and commit the result.`,
      );
    }

    expect(committed).toBe(generated);
  }, 30_000);
});
