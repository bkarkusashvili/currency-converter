import { IncomingMessage, ServerResponse } from 'node:http';
import { AppConfig } from '../../../config/app-config';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { buildLoggerParams } from '../build-logger-params';

// The parts of pino-http's options this module fills in. Reaching for them
// through the built params is what makes the assertions below exercise the
// wiring rather than restate it.
interface RequestLoggerOptions {
  level: string;
  autoLogging: boolean;
  transport?: { target: string };
  genReqId: (request: IncomingMessage, response: ServerResponse) => unknown;
  customLogLevel: (
    request: IncomingMessage,
    response: ServerResponse,
    error?: Error,
  ) => string;
  serializers: {
    req: (request: IncomingMessage) => unknown;
    res: (response: ServerResponse) => unknown;
  };
}

function createConfig(values: Partial<AppConfig>): TypedConfigService {
  return {
    get: (key: keyof AppConfig) => values[key],
  } as unknown as TypedConfigService;
}

function optionsFor(values: Partial<AppConfig>): RequestLoggerOptions {
  return buildLoggerParams(createConfig(values))
    .pinoHttp as unknown as RequestLoggerOptions;
}

const production = { NODE_ENV: 'production', LOG_LEVEL: 'info' } as const;

function createRequest(fields: Record<string, unknown>): IncomingMessage {
  return { headers: {}, socket: {}, ...fields } as unknown as IncomingMessage;
}

function createResponse(statusCode: number): ServerResponse {
  return { statusCode } as unknown as ServerResponse;
}

describe('buildLoggerParams', () => {
  it('logs at the configured level and logs every request once it completes', () => {
    const options = optionsFor({ NODE_ENV: 'production', LOG_LEVEL: 'warn' });

    expect(options.level).toBe('warn');
    expect(options.autoLogging).toBe(true);
  });

  it('pretty prints in development only', () => {
    expect(
      optionsFor({ NODE_ENV: 'development', LOG_LEVEL: 'info' }).transport,
    ).toMatchObject({ target: 'pino-pretty' });
  });

  it.each(['production', 'test'] as const)(
    'emits plain JSON in %s, where pino-pretty is not installed',
    (nodeEnv) => {
      expect(
        optionsFor({ NODE_ENV: nodeEnv, LOG_LEVEL: 'info' }).transport,
      ).toBeUndefined();
    },
  );

  it('keeps the id the middleware already assigned', () => {
    const { genReqId } = optionsFor(production);
    const request = createRequest({ id: 'trace-1' });

    expect(genReqId(request, createResponse(200))).toBe('trace-1');
  });

  it('lifts a failed request above the ordinary traffic', () => {
    const { customLogLevel } = optionsFor(production);
    const request = createRequest({ url: '/api/v1/convert' });

    expect(customLogLevel(request, createResponse(503))).toBe('error');
    expect(customLogLevel(request, createResponse(429))).toBe('warn');
    expect(customLogLevel(request, createResponse(200))).toBe('info');
  });

  it('keeps credentials out of the log by projecting the request', () => {
    const { serializers } = optionsFor(production);
    const request = createRequest({
      method: 'DELETE',
      url: '/api/v1/rates/cache',
      headers: { authorization: 'Bearer secret', 'x-api-key': 'admin-key' },
    });

    expect(JSON.stringify(serializers.req(request))).not.toMatch(
      /secret|admin-key/,
    );
  });

  it('keeps the response down to its status', () => {
    const { serializers } = optionsFor(production);

    expect(serializers.res(createResponse(204))).toStrictEqual({
      statusCode: 204,
    });
  });
});
