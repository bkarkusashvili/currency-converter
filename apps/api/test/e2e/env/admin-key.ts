// ConfigModule.forRoot reads process.env while app.module.ts is being imported,
// so a suite that needs different configuration has to set it before that
// import runs. Importing this module first is what guarantees the order.
export const ADMIN_API_KEY = 'e2e-admin-key';

process.env.ADMIN_API_KEY = ADMIN_API_KEY;
