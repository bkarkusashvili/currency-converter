// The two container-backed suites run only when they are pointed at a real
// service. Everywhere else — a laptop with nothing running, a fork's CI, the
// `api` job, which has no services — they skip, and they say so on stdout:
// Jest prints no per-suite line when every suite in a file is skipped, so the
// whole report would otherwise be `Test Suites: 2 skipped` and a pipeline that
// silently stopped exercising the drivers would read as green.
//
// In CI a missing variable is an error rather than a skip. The `orchestration`
// job starts Redis and Mongo and points both variables at them, so there is no
// honest reason for either to be unset there; deleting the env block has to go
// red rather than quietly stop testing the drivers.
//
// This is the seam the rest of the suite cannot take. Every other test of the
// Redis and Mongo adapters runs against a hand-written fake, which validates
// the assumption the fake's author had rather than the driver's behaviour;
// these two check the handful of places where that assumption is load-bearing:
// the TTLs the cache is actually written with, the round trip through both of
// its keys, the index Mongo actually holds, and the sort the page is read back
// in.
export function describeAgainst(
  name: string,
  variable: string,
  suite: (url: string) => void,
): void {
  const url = process.env[variable];

  if (url === undefined || url === '') {
    if (isCi()) {
      throw new Error(
        `${name} cannot be skipped in CI: ${variable} is unset, but the ` +
          `orchestration job starts the service and sets it. Point it at the ` +
          `running service or remove this suite.`,
      );
    }

    // Written straight to stdout rather than through `console.log`: Jest's
    // console capture would file the line under whichever test file happened
    // to be loading, and this is a fact about the run, not about a test.
    process.stdout.write(
      `SKIPPED: ${name} — set ${variable} to run it against a real service\n`,
    );

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

// GitHub Actions sets `CI=true`; the empty-string check is the same one the
// URLs get, so an explicitly blanked variable is not a truthy environment.
function isCi(): boolean {
  return process.env.CI !== undefined && process.env.CI !== '';
}
