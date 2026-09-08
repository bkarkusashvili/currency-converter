import { RATES_CACHE_KEYS } from '../rates-cache-keys';

// Every other spec reads a key through this constant, which makes renaming one
// invisible to the suite and visible only in production: the next deploy would
// start reading a key nothing wrote, orphaning the cache every running instance
// shares. The literals are the contract between deploys, so one test states
// them rather than reading them back.
describe('RATES_CACHE_KEYS', () => {
  it('names the keys every deployed instance already shares', () => {
    expect(RATES_CACHE_KEYS).toStrictEqual({
      fresh: 'rates:latest',
      stale: 'rates:fallback',
    });
  });
});
