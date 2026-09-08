import { AppConfig } from '../../config/app-config';
import type { TypedConfigService } from '../../config/typed-config.service';
import { assignRequestId } from './assign-request-id';
import { buildLoggerParams } from './build-logger-params';

function createConfig(values: Partial<AppConfig>): TypedConfigService {
  return {
    get: (key: keyof AppConfig) => values[key],
  } as unknown as TypedConfigService;
}

describe('buildLoggerParams', () => {
  it('uses the configured log level and the shared request id generator', () => {
    const { pinoHttp } = buildLoggerParams(
      createConfig({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }),
    );

    expect(pinoHttp).toMatchObject({
      level: 'warn',
      autoLogging: true,
      genReqId: assignRequestId,
    });
  });

  it('pretty prints in development only', () => {
    const development = buildLoggerParams(
      createConfig({ NODE_ENV: 'development', LOG_LEVEL: 'info' }),
    );

    expect(development.pinoHttp).toMatchObject({
      transport: { target: 'pino-pretty' },
    });
  });

  it.each(['production', 'test'] as const)(
    'emits plain JSON in %s, where pino-pretty is not installed',
    (nodeEnv) => {
      const { pinoHttp } = buildLoggerParams(
        createConfig({ NODE_ENV: nodeEnv, LOG_LEVEL: 'info' }),
      );

      expect(pinoHttp).toHaveProperty('transport', undefined);
    },
  );

  it('redacts the admin key and credential headers', () => {
    const { pinoHttp } = buildLoggerParams(
      createConfig({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
    );

    expect(pinoHttp).toMatchObject({
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
        ],
        remove: true,
      },
    });
  });
});
