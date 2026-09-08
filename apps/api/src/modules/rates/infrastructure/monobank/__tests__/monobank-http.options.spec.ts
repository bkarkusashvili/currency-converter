import { fakeConfig } from '../../../../../config/__tests__/fake-config';
import { buildMonobankHttpOptions } from '../monobank-http.options';

describe('buildMonobankHttpOptions', () => {
  // The per-request deadline the retry and the total budget are built on top
  // of: a client without one waits on the upstream's socket for as long as it
  // is willing to hold it.
  it('bounds a request with the configured timeout', () => {
    expect(
      buildMonobankHttpOptions(fakeConfig({ MONOBANK_TIMEOUT_MS: 1234 })),
    ).toMatchObject({ timeout: 1234 });
  });
});
