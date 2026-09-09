import { Params } from 'nestjs-pino';
import { TypedConfigService } from '../../config/typed-config.service';
import { assignRequestId } from './request-id.util';
import { resolveLogLevel } from './resolve-log-level.util';
import {
  serializeError,
  serializeRequest,
  serializeResponse,
} from './serializers.util';
export function buildLoggerParams(config: TypedConfigService): Params {
  const isDevelopment =
    config.get('NODE_ENV', { infer: true }) === 'development';

  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      // requestIdMiddleware has already assigned the id; this only covers a
      // request that somehow reached pino without passing through it.
      genReqId: assignRequestId,
      autoLogging: true,
      // Without this every completed request is logged at info, whatever it
      // answered.
      customLogLevel: resolveLogLevel,
      // Hand the serializers the raw request and response instead of
      // pino-std-serializers' already-expanded shape, which is what they are
      // replacing.
      wrapSerializers: false,
      // Only the documented fields reach the log, so no header - the admin key
      // and Authorization among them - can be written by accident. This
      // replaces the redact denylist, which had to name each one. `err` is
      // projected for the same reason and one more: pino's default walks an
      // axios error's whole `config` onto the line, headers included.
      serializers: {
        req: serializeRequest,
        res: serializeResponse,
        err: serializeError,
      },
      // pino-pretty is a devDependency, so it must never be reached from a
      // production image; every other environment emits newline delimited JSON.
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          }
        : undefined,
    },
  };
}
