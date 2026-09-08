// ConfigModule.forRoot reads process.env while app.module.ts is being imported,
// which happens before any beforeAll hook, so the suite's environment has to be
// in place first.
process.env.LOG_LEVEL = 'silent';
// The suite shares one client address; a production-sized window would start
// rejecting requests part way through.
process.env.THROTTLE_LIMIT = '1000';
