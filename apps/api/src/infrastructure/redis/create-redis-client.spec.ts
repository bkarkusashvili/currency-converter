import { Logger } from '@nestjs/common';
import type { TypedConfigService } from '../../config/typed-config.service';
import { createRedisClient } from './create-redis-client';

function createConfig(redisUrl: string): TypedConfigService {
  return { get: () => redisUrl } as unknown as TypedConfigService;
}

describe('createRedisClient', () => {
  const client = createRedisClient(createConfig('redis://localhost:6379'));

  afterAll(() => {
    client.disconnect();
  });

  it('does not connect while being constructed, so startup never blocks on redis', () => {
    expect(client.status).toBe('wait');
  });

  it('fails a command fast rather than queueing it while disconnected', () => {
    expect(client.options.enableOfflineQueue).toBe(false);
    expect(client.options.maxRetriesPerRequest).toBe(1);
    expect(client.options.lazyConnect).toBe(true);
  });

  it('takes its host and port from the configured url', () => {
    expect(client.options).toMatchObject({ host: 'localhost', port: 6379 });
  });

  it('logs a connection error as a warning instead of letting it escape', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const other = createRedisClient(createConfig('redis://localhost:6379'));

    expect(() => other.emit('error', new Error('ECONNREFUSED'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith('Redis connection error: ECONNREFUSED');

    other.disconnect();
    warn.mockRestore();
  });
});
