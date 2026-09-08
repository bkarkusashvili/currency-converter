import { EventEmitter } from 'node:events';
import type Redis from 'ioredis';

// The exact ioredis rejection when a command is issued while the socket is
// down and the offline queue is disabled.
export const OFFLINE_QUEUE_REJECTION =
  "Stream isn't writeable and enableOfflineQueue options is false";

export const CONNECT_REFUSED = 'connect ECONNREFUSED 127.0.0.1:6379';

// What ioredis rejects a command with once it outlives `commandTimeout`. The
// socket is up and the command was written, so the deadline is the only thing
// that ever ends the wait.
export const COMMAND_TIMED_OUT = 'Command timed out';

interface FakeRedisOptions {
  unreachable?: boolean;
  quitFails?: boolean;
  // Connected, but no command ever comes back: the stall `unreachable` cannot
  // model and the one the command deadline exists for.
  commandsTimeOut?: boolean;
}

// A pipeline queues commands and runs them on exec. ioredis reports a command
// that failed on a live connection as an entry error rather than a rejection,
// and rejects the whole exec only when the socket is unusable, which is what
// the queued command's own rejection reproduces here.
class FakeRedisPipeline {
  private readonly queued: (() => Promise<unknown>)[] = [];

  constructor(private readonly client: FakeRedisClient) {}

  set(
    key: string,
    value: string,
    mode?: 'EX',
    ttlSeconds?: number,
  ): FakeRedisPipeline {
    this.queued.push(() => this.client.set(key, value, mode, ttlSeconds));

    return this;
  }

  async exec(): Promise<[Error | null, unknown][]> {
    const results: [Error | null, unknown][] = [];

    for (const command of this.queued) {
      results.push([null, await command()]);
    }

    return results;
  }
}

// Models the two ioredis behaviours this module is built around: a lazyConnect
// client starts in 'wait' without opening a socket, and with the offline queue
// disabled every command issued before connect() has resolved is rejected
// instead of buffered. Reproducing that here is what makes the eager connect
// observable without a live server.
export class FakeRedisClient extends EventEmitter {
  status: 'wait' | 'ready' | 'end' = 'wait';
  quitCalls = 0;
  disconnectCalls = 0;

  private readonly store = new Map<string, string>();
  private readonly ttls = new Map<string, number>();

  constructor(private readonly options: FakeRedisOptions = {}) {
    super();
  }

  connect(): Promise<void> {
    if (this.options.unreachable === true) {
      return Promise.reject(new Error(CONNECT_REFUSED));
    }

    this.status = 'ready';

    return Promise.resolve();
  }

  // Every command goes through the same two ways a live-looking client refuses
  // to answer, so a spec picks which one it is testing by the option it built
  // the fake with rather than by the command it happens to call.
  private refusal(): Error | undefined {
    if (this.options.commandsTimeOut === true) {
      return new Error(COMMAND_TIMED_OUT);
    }

    return this.status === 'ready'
      ? undefined
      : new Error(OFFLINE_QUEUE_REJECTION);
  }

  get(key: string): Promise<string | null> {
    const refusal = this.refusal();

    return refusal
      ? Promise.reject(refusal)
      : Promise.resolve(this.store.get(key) ?? null);
  }

  set(
    key: string,
    value: string,
    mode?: 'EX',
    ttlSeconds?: number,
  ): Promise<'OK'> {
    const refusal = this.refusal();

    if (refusal) {
      return Promise.reject(refusal);
    }

    this.store.set(key, value);

    if (mode === 'EX' && ttlSeconds !== undefined) {
      this.ttls.set(key, ttlSeconds);
    }

    return Promise.resolve('OK');
  }

  del(...keys: string[]): Promise<number> {
    const refusal = this.refusal();

    if (refusal) {
      return Promise.reject(refusal);
    }

    const removed = keys.filter((key) => this.store.delete(key)).length;

    for (const key of keys) {
      this.ttls.delete(key);
    }

    return Promise.resolve(removed);
  }

  ping(): Promise<'PONG'> {
    const refusal = this.refusal();

    return refusal ? Promise.reject(refusal) : Promise.resolve('PONG');
  }

  pipeline(): FakeRedisPipeline {
    return new FakeRedisPipeline(this);
  }

  quit(): Promise<'OK'> {
    this.quitCalls += 1;

    if (this.options.quitFails === true) {
      return Promise.reject(new Error(OFFLINE_QUEUE_REJECTION));
    }

    this.status = 'end';

    return Promise.resolve('OK');
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.status = 'end';
  }

  // What a test asserts on: the TTL a write asked for, and the raw value, so a
  // suite can seed a corrupt entry or check what expiry the cache set.
  ttlOf(key: string): number | undefined {
    return this.ttls.get(key);
  }

  stored(key: string): string | undefined {
    return this.store.get(key);
  }

  seed(key: string, value: string): void {
    this.store.set(key, value);
  }

  // The production code takes an ioredis client; the fake only implements the
  // handful of members it actually uses.
  asRedis(): Redis {
    return this as unknown as Redis;
  }
}
