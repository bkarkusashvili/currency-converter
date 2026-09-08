import { EventEmitter } from 'node:events';
import { ConnectionStates } from 'mongoose';
import type { Connection } from 'mongoose';

export const CONNECT_REFUSED = 'connect ECONNREFUSED 127.0.0.1:27017';

interface FakeMongoOptions {
  unreachable?: boolean;
  pingFails?: boolean;
  pingNeverAnswers?: boolean;
}

// The model side of the fake: enough of a mongoose Model for the providers a
// boot instantiates. What a repository does with a model is exercised against
// its own double, where the queries are what is being asserted.
class FakeMongoModel {
  syncIndexCalls = 0;

  syncIndexes(): Promise<string[]> {
    this.syncIndexCalls += 1;

    return Promise.resolve([]);
  }
}

// Models the mongoose behaviours this module is built around: a connection
// created without being awaited starts in `connecting`, an initial connection
// that fails is never retried by mongoose itself, and a command issued before
// the connection is up is rejected rather than buffered. Reproducing them here
// is what makes the degradation observable without a live server.
export class FakeMongoConnection extends EventEmitter {
  readyState: ConnectionStates = ConnectionStates.connecting;
  openCalls = 0;
  closeCalls = 0;

  private readonly models = new Map<string, FakeMongoModel>();

  constructor(private options: FakeMongoOptions = {}) {
    super();
  }

  // What the first connection attempt does once the socket answers, or does
  // not: mongoose reports a failure as a state change followed by an error.
  settle(): void {
    if (this.options.unreachable === true) {
      this.fail(new Error(CONNECT_REFUSED));

      return;
    }

    this.readyState = ConnectionStates.connected;
    this.emit('connected');
  }

  openUri(): Promise<FakeMongoConnection> {
    this.openCalls += 1;

    if (this.options.unreachable === true) {
      const error = new Error(CONNECT_REFUSED);
      this.fail(error);

      return Promise.reject(error);
    }

    this.readyState = ConnectionStates.connected;
    this.emit('connected');

    return Promise.resolve(this);
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    this.readyState = ConnectionStates.disconnected;
    this.emit('disconnected');

    return Promise.resolve();
  }

  model(name: string): FakeMongoModel {
    const model = this.models.get(name) ?? new FakeMongoModel();
    this.models.set(name, model);

    return model;
  }

  // The first attempt failing before anything was listening. Mongoose drops an
  // `error` that has no listener and emits no `disconnected` for a first
  // attempt at all, so nothing survives the failure but the state — which is
  // exactly the case a module that attaches its listeners after the factory
  // started connecting has to read rather than wait for.
  failsBeforeAnyoneWatches(): void {
    this.options = { ...this.options, unreachable: true };
    this.readyState = ConnectionStates.disconnected;
  }

  // The server the next attempt finds, so a suite can watch a connection
  // recover rather than only fail.
  comesBack(): void {
    this.options = { ...this.options, unreachable: false };
  }

  goesDown(): void {
    this.readyState = ConnectionStates.disconnected;
    this.emit('disconnected');
  }

  get db(): { admin(): { ping(): Promise<unknown> } } | undefined {
    if (this.readyState !== ConnectionStates.connected) {
      return undefined;
    }

    return { admin: () => ({ ping: () => this.ping() }) };
  }

  // The production code takes a mongoose Connection; the fake implements the
  // handful of members it actually uses.
  asConnection(): Connection {
    return this as unknown as Connection;
  }

  private ping(): Promise<unknown> {
    if (this.options.pingNeverAnswers === true) {
      return new Promise<unknown>(() => undefined);
    }

    return this.options.pingFails === true
      ? Promise.reject(new Error(CONNECT_REFUSED))
      : Promise.resolve({ ok: 1 });
  }

  private fail(error: Error): void {
    this.readyState = ConnectionStates.disconnected;
    this.emit('disconnected');
    this.emit('error', error);
  }
}
