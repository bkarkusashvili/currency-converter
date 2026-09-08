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

  // The other half of the bound: the timeout says how long a response may take
  // and said nothing about how large it may be, so a url pointed somewhere else
  // could stream an arbitrary body into memory inside the budget.
  it('refuses a response too large to be a rate list', () => {
    const options = buildMonobankHttpOptions(
      fakeConfig({ MONOBANK_TIMEOUT_MS: 1234 }),
    );

    expect(options.maxContentLength).toBeGreaterThan(1_000_000);
    expect(options.maxContentLength).toBeLessThan(10_000_000);
    expect(options.maxBodyLength).toBe(options.maxContentLength);
  });
});
