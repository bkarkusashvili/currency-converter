import { validateEnv } from '../validate-env.util';

describe('validateEnv', () => {
  describe('defaults', () => {
    it('applies every default from the configuration table', () => {
      expect(validateEnv({})).toStrictEqual({
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'info',
        TRUST_PROXY: false,
        CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:8080'],
        REDIS_URL: 'redis://localhost:6379',
        REDIS_COMMAND_TIMEOUT_MS: 300,
        MONGO_URL: 'mongodb://localhost:27017/currency_converter',
        MONGO_SERVER_SELECTION_TIMEOUT_MS: 3000,
        HISTORY_OPERATION_TIMEOUT_MS: 1000,
        HISTORY_TTL_DAYS: 30,
        MONOBANK_API_URL: 'https://api.monobank.ua/bank/currency',
        MONOBANK_TIMEOUT_MS: 5000,
        MONOBANK_RETRY_ATTEMPTS: 3,
        MONOBANK_RETRY_BASE_DELAY_MS: 300,
        MONOBANK_TOTAL_BUDGET_MS: 8000,
        CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5,
        CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 30000,
        RATES_CACHE_TTL_SECONDS: 300,
        RATES_STALE_TTL_SECONDS: 86400,
        THROTTLE_TTL_SECONDS: 60,
        THROTTLE_LIMIT: 60,
        ADMIN_API_KEY: null,
      });
    });

    it('treats a blank value as unset so the default still applies', () => {
      expect(validateEnv({ PORT: '   ', LOG_LEVEL: '' })).toMatchObject({
        PORT: 3000,
        LOG_LEVEL: 'info',
      });
    });

    it('leaves ADMIN_API_KEY null rather than undefined when unset', () => {
      expect(validateEnv({ ADMIN_API_KEY: '' }).ADMIN_API_KEY).toBeNull();
    });

    it('ignores variables that are not part of the schema', () => {
      expect(validateEnv({ SOME_OTHER_TOOL: 'x' })).not.toHaveProperty(
        'SOME_OTHER_TOOL',
      );
    });
  });

  describe('coercion and overrides', () => {
    it('coerces numeric variables from their string form', () => {
      const config = validateEnv({ PORT: '8080', THROTTLE_LIMIT: '5' });

      expect(config.PORT).toBe(8080);
      expect(config.THROTTLE_LIMIT).toBe(5);
    });

    it('keeps a provided value over the default', () => {
      expect(validateEnv({ LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug');
      expect(validateEnv({ ADMIN_API_KEY: 'secret' }).ADMIN_API_KEY).toBe(
        'secret',
      );
    });
  });

  // ApiKeyGuard is open while the key is unset, which is what makes a local run
  // need no secret and what makes a deployment without one a lever on an
  // upstream that allows one request a minute.
  describe('admin key', () => {
    it('refuses a production configuration that names no key', () => {
      expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
        /- ADMIN_API_KEY: is required when NODE_ENV is production/,
      );
    });

    it('accepts a production configuration that names one', () => {
      expect(
        validateEnv({ NODE_ENV: 'production', ADMIN_API_KEY: 'secret' })
          .ADMIN_API_KEY,
      ).toBe('secret');
    });

    it.each(['development', 'test'])(
      'leaves %s permissive so a local run needs no secret',
      (nodeEnv) => {
        expect(validateEnv({ NODE_ENV: nodeEnv }).ADMIN_API_KEY).toBeNull();
      },
    );
  });

  describe('trust proxy', () => {
    it('trusts nobody unless told to', () => {
      expect(validateEnv({}).TRUST_PROXY).toBe(false);
    });

    it.each([
      ['false', false],
      ['true', true],
    ])('reads %s as a boolean', (value, expected) => {
      expect(validateEnv({ TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
    });

    it.each([
      ['0', 0],
      ['1', 1],
      ['3', 3],
    ])('reads %s as a hop count', (value, expected) => {
      expect(validateEnv({ TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
    });

    it.each(['yes', '-1', '1.5', '11'])('rejects %s', (value) => {
      expect(() => validateEnv({ TRUST_PROXY: value })).toThrow(
        /- TRUST_PROXY:/,
      );
    });
  });

  describe('list parsing', () => {
    it('splits a comma separated list and trims each entry', () => {
      expect(
        validateEnv({ CORS_ORIGINS: 'https://a.example, https://b.example' })
          .CORS_ORIGINS,
      ).toStrictEqual(['https://a.example', 'https://b.example']);
    });

    it('drops empty entries produced by stray separators', () => {
      expect(
        validateEnv({ CORS_ORIGINS: 'https://a.example,,  ,' }).CORS_ORIGINS,
      ).toStrictEqual(['https://a.example']);
    });

    it('accepts a single origin', () => {
      expect(
        validateEnv({ CORS_ORIGINS: 'https://a.example' }).CORS_ORIGINS,
      ).toStrictEqual(['https://a.example']);
    });

    it('rejects a list that has no usable entry', () => {
      expect(() => validateEnv({ CORS_ORIGINS: ' , , ' })).toThrow(
        /CORS_ORIGINS/,
      );
    });
  });

  describe('invalid values', () => {
    it.each([
      ['PORT', 'not-a-number'],
      ['PORT', '0'],
      ['PORT', '70000'],
      ['NODE_ENV', 'staging'],
      ['LOG_LEVEL', 'chatty'],
      ['REDIS_URL', 'not-a-url'],
      ['REDIS_COMMAND_TIMEOUT_MS', '0'],
      ['MONGO_URL', 'not-a-url'],
      ['MONOBANK_API_URL', 'not-a-url'],
      ['MONOBANK_TIMEOUT_MS', '-1'],
      ['MONOBANK_RETRY_ATTEMPTS', '1.5'],
      ['THROTTLE_LIMIT', '0'],
    ])('rejects %s=%s', (variable, value) => {
      expect(() => validateEnv({ [variable]: value })).toThrow(
        new RegExp(`- ${variable}:`),
      );
    });

    it('lists every invalid variable in one readable error', () => {
      expect(() =>
        validateEnv({ PORT: 'nope', LOG_LEVEL: 'loud', REDIS_URL: 'nope' }),
      ).toThrow(
        /^Invalid environment configuration:\n {2}- PORT: .+\n {2}- LOG_LEVEL: .+\n {2}- REDIS_URL: .+$/,
      );
    });
  });
});
