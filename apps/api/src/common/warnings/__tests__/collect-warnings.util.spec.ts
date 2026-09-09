import { collectWarnings } from '../collect-warnings.util';

describe('collectWarnings', () => {
  // Absent, not empty: every response would otherwise carry a field a client
  // has to look inside before it knows there is nothing to report.
  it('answers with nothing at all when nothing degraded', () => {
    expect(
      collectWarnings({
        CACHE_UNAVAILABLE: false,
        HISTORY_NOT_RECORDED: false,
      }),
    ).toBeUndefined();
  });

  it('answers with nothing when it is asked about nothing', () => {
    expect(collectWarnings({})).toBeUndefined();
  });

  it('reports a degradation with the code and a sentence to render', () => {
    expect(collectWarnings({ CACHE_UNAVAILABLE: true })).toStrictEqual([
      { code: 'CACHE_UNAVAILABLE', message: expect.any(String) as string },
    ]);
  });

  it('reports every degradation of one request', () => {
    const warnings = collectWarnings({
      CACHE_UNAVAILABLE: true,
      HISTORY_NOT_RECORDED: true,
    });

    expect(warnings?.map((warning) => warning.code)).toStrictEqual([
      'CACHE_UNAVAILABLE',
      'HISTORY_NOT_RECORDED',
    ]);
  });

  // The flag behind this code is raised by a failed read, a failed write, or
  // both, so any sentence about where the rates came from is one the warning
  // cannot know: a read that timed out and a write that then succeeded was
  // cached after all, and a degraded read answered from the stale key never
  // reached the upstream. `source` is on the same response and answers it.
  it('says the cache was not reached without saying what answered instead', () => {
    const [warning] = collectWarnings({ CACHE_UNAVAILABLE: true }) ?? [];

    expect(warning?.message).not.toMatch(/upstream|fetch|provider|stale/i);
    expect(warning?.message).toContain('source');
  });

  // The message is the contract a client renders, so the same code cannot
  // arrive worded two ways.
  it('gives a code the same message wherever it is reported', () => {
    const [first] = collectWarnings({ HISTORY_NOT_RECORDED: true }) ?? [];
    const [second] = collectWarnings({ HISTORY_NOT_RECORDED: true }) ?? [];

    expect(first?.message).toBe(second?.message);
    expect(first?.message).toContain('/history');
  });
});
