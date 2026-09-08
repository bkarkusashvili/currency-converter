import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import {
  createOutageReporter,
  OutageReporter,
} from '../../common/logging/outage-reporter';
import type { TypedConfigService } from '../../config/typed-config.service';
import { buildMongoConnectOptions } from './mongo-connect.options';

// The driver monitors a connection it has already opened and restores it on its
// own, but an initial connection that failed is never retried: without this the
// history would stay down until the next deploy because Mongo happened to be
// starting when the API did. The delay is a constant rather than an env var
// because nothing about a deployment makes another value right.
const RECONNECT_DELAY_MS = 5000;

@Injectable()
export class MongoConnection implements OnModuleInit, OnApplicationShutdown {
  private retryTimer: NodeJS.Timeout | undefined;
  private established = false;
  private stopping = false;
  // No `restored` message: what to say about a connection coming back depends
  // on whether it had ever been up, which this class knows and the reporter
  // does not.
  private readonly outage: OutageReporter;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoConnection.name);
    this.outage = createOutageReporter(this.logger, {
      down: 'MongoDB is unavailable, the conversion history is degraded',
      stillDown:
        'MongoDB is still unreachable, the conversion history stays degraded',
    });
  }

  onModuleInit(): void {
    this.connection.on('connected', () => {
      this.reportUp();
    });
    this.connection.on('disconnected', () => {
      this.reportDown();
    });
    // Mongoose only emits this once a listener exists, and every attempt of an
    // outage emits one, so the report is levelled by whether the state changed.
    this.connection.on('error', (error: Error) => {
      this.reportDown(error);
    });

    // Both fallbacks matter, because the factory started connecting before this
    // hook ran. An attempt that succeeded in the meantime emitted its
    // `connected` to nobody; one that failed emitted nothing at all — mongoose
    // drops the `error` when no listener exists yet and never emits
    // `disconnected` for a first attempt — so the state is all that is left of
    // it, and without this branch a DNS or TLS failure would arm no retry and
    // leave the history down until the next deploy.
    if (this.connection.readyState === ConnectionStates.connected) {
      this.reportUp();
    } else if (this.connection.readyState === ConnectionStates.disconnected) {
      this.reportDown();
    }
  }

  // Closing emits the same disconnect an outage does, and a shutdown is not an
  // outage: the flag is what keeps the last line of the process from being a
  // warning about a database nothing is going to ask for again.
  //
  // A shutdown hook rather than a destroy hook, for the same reason the Redis
  // one is: Nest closes the HTTP listener in `dispose()`, between the two, so
  // closing here leaves the requests still in flight with a store to write to.
  //
  // `MongooseCoreModule` closes this same connection in a shutdown hook of its
  // own, so the close below is deliberately one of two — and the order is what
  // makes it the useful one. Nest calls `onApplicationShutdown` from the root
  // outwards (`callShutdownHook` reverses the distance order it initialises
  // in), and the core module is imported by this one, so this hook runs first:
  // it sets `stopping` and cancels the retry timer while the connection is
  // still open, and the disconnect the core module's close then emits arrives
  // at a listener that knows a shutdown is in progress. Without it the last
  // line of the process would be a warning about a database nothing is going
  // to ask for again. Closing an already-closed connection resolves, so
  // whichever of the two runs second costs nothing.
  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;

    await this.connection.close();
  }

  private reportUp(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;

    this.outage.clear();
    this.logger.info(
      this.established
        ? 'MongoDB connection restored'
        : 'MongoDB connection established',
    );

    this.established = true;
  }

  private reportDown(error?: Error): void {
    if (this.stopping) {
      return;
    }

    this.outage.report(error);
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    // Once a connection has been established the driver owns getting it back,
    // and opening a second one over the top of that would leak the first.
    if (this.established || this.retryTimer !== undefined) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.retry();
    }, RECONNECT_DELAY_MS);
    // A pending timer keeps the process alive; a retry is never a reason not to
    // exit.
    this.retryTimer.unref();
  }

  private async retry(): Promise<void> {
    if (
      this.established ||
      this.connection.readyState !== ConnectionStates.disconnected
    ) {
      return;
    }

    try {
      await this.connection.openUri(
        this.config.get('MONGO_URL', { infer: true }),
        buildMongoConnectOptions(this.config),
      );
    } catch {
      // The rejection repeats what the error event already reported, and the
      // event handler is what schedules the next attempt.
    }
  }
}
