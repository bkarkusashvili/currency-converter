// ConfigModule.forRoot reads process.env while app.module.ts is being imported,
// so a suite that needs different configuration has to set it before that
// import runs. Importing this module first is what guarantees the order.
process.env.THROTTLE_LIMIT = '2';
process.env.THROTTLE_TTL_SECONDS = '60';
// One proxy in front of the process, as on Railway or behind a single nginx.
process.env.TRUST_PROXY = '1';
