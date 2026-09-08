import { EventEmitter } from 'node:events';
import type Redis from 'ioredis';

// The exact ioredis rejection when a command is issued while the socket is
// down and the offline queue is disabled.
export const OFFLINE_QUEUE_REJECTION =
  "Stream isn't writeable and enableOfflineQueue options is false";

export const CONNECT_REFUSED = 'connect ECONNREFUSED 127.0.0.1:6379';

interface FakeRedisOptions {
  unreachable?: boolean;
  quitFails?: boolean;
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

  get(key: string): Promise<string | null> {
    return this.status === 'ready'
      ? Promise.resolve(this.store.get(key) ?? null)
      : Promise.reject(new Error(OFFLINE_QUEUE_REJECTION));
  }

  set(key: string, value: string): Promise<'OK'> {
    if (this.status !== 'ready') {
      return Promise.reject(new Error(OFFLINE_QUEUE_REJECTION));
    }

    this.store.set(key, value);

    return Promise.resolve('OK');
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

  // The production code takes an ioredis client; the fake only implements the
  // handful of members it actually uses.
  asRedis(): Redis {
    return this as unknown as Redis;
  }
}
