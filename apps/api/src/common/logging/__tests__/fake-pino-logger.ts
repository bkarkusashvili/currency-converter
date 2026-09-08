import type { PinoLogger } from 'nestjs-pino';

export interface FakePinoLogger {
  setContext: jest.Mock;
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  asPinoLogger(): PinoLogger;
}

export function createFakePinoLogger(): FakePinoLogger {
  const fake = {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    asPinoLogger(): PinoLogger {
      return fake as unknown as PinoLogger;
    },
  };

  return fake;
}
