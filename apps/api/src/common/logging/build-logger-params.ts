import { Params } from 'nestjs-pino';
import { TypedConfigService } from '../../config/typed-config.service';
import { assignRequestId } from './assign-request-id';

export function buildLoggerParams(config: TypedConfigService): Params {
  const isDevelopment =
    config.get('NODE_ENV', { infer: true }) === 'development';

  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      genReqId: assignRequestId,
      autoLogging: true,
      // pino-pretty is a devDependency, so it must never be reached from a
      // production image; every other environment emits newline delimited JSON.
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          }
        : undefined,
      // The admin key and credentials would otherwise be logged verbatim with
      // the request headers.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
        ],
        remove: true,
      },
    },
  };
}
