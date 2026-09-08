// The two container-backed suites run only when they are pointed at a real
// service. Everywhere else — a laptop with nothing running, a fork's CI, the
// `api` job, which has no services — they skip *visibly*: `describe.skip`
// reports the suite as skipped with the variable that would have run it in its
// name, so a pipeline that silently stopped exercising the drivers reads as
// skipped rather than as green.
//
// This is the seam the rest of the suite cannot take. Every other test of the
// Redis and Mongo adapters runs against a hand-written fake, which validates
// the assumption the fake's author had rather than the driver's behaviour;
// these two check the handful of places where that assumption is load-bearing:
// the TTLs the cache is actually written with, the MULTI that writes both keys,
// the index Mongo actually holds, and the sort the page is read back in.
export function describeAgainst(
  name: string,
  variable: string,
  suite: (url: string) => void,
): void {
  const url = process.env[variable];

  if (url === undefined || url === '') {
    describe.skip(`${name} (set ${variable} to run this against a real service)`, () => {
      it('is skipped', () => {
        expect(true).toBe(true);
      });
    });

    return;
  }

  describe(name, () => {
    suite(url);
  });
}
