// ConfigModule.forRoot reads process.env while app.module.ts is being imported,
// which happens before any beforeAll hook, so the suite's environment has to be
// in place first.
process.env.LOG_LEVEL = 'silent';
// The suite shares one client address; a production-sized window would start
// rejecting requests part way through.
process.env.THROTTLE_LIMIT = '1000';
// A suite that needs different configuration sets it in its own env module, and
// the worker runs the suites in one process: without a baseline here the proxy
// depth or the admin key one suite sets would still be in place for the next.
process.env.TRUST_PROXY = 'false';
delete process.env.ADMIN_API_KEY;
// Every suite overrides REDIS_CLIENT with the fake, and this is what keeps that
// true: pointed at a port nothing listens on, a suite that forgot the override
// reports the cache down on /health instead of passing on whatever Redis the
// developer happens to have running.
process.env.REDIS_URL = 'redis://127.0.0.1:1';
