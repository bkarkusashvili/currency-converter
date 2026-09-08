// ConfigModule.forRoot reads process.env while app.module.ts is being imported,
// which happens before any beforeAll hook, so the suite's environment has to be
// in place first.
process.env.LOG_LEVEL = 'silent';
// The suite shares one client address; a production-sized window would start
// rejecting requests part way through.
process.env.THROTTLE_LIMIT = '1000';
// A suite that needs a different value sets it in its own env module, and the
// worker runs the suites in one process: without a baseline here the proxy
// depth one suite sets would still be in place for the next one.
process.env.TRUST_PROXY = 'false';
