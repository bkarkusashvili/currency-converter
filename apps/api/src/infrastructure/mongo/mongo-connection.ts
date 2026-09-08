import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import type { TypedConfigService } from '../../config/typed-config.service';
import { buildMongoConnectOptions } from './mongo-connect.options';

// The driver monitors a connection it has already opened and restores it on its
// own, but an initial connection that failed is never retried: without this the
// history would stay down until the next deploy because Mongo happened to be
// starting when the API did. The delay is a constant rather than an env var
// because nothing about a deployment makes another value right.
const RECONNECT_DELAY_MS = 5000;

@Injectable()
export class MongoConnection implements OnModuleInit, OnModuleDestroy {
  private retryTimer: NodeJS.Timeout | undefined;
  private established = false;
  private outageReported = false;
  private stopping = false;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoConnection.name);
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
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;

    await this.connection.close();
  }

  private reportUp(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;

    if (this.established) {
      this.logger.info('MongoDB connection restored');
    } else {
      this.logger.info('MongoDB connection established');
    }

    this.established = true;
    this.outageReported = false;
  }

  private reportDown(error?: Error): void {
    if (this.stopping) {
      return;
    }

    if (this.outageReported) {
      this.logger.debug(
        { err: error },
        'MongoDB is still unreachable, the conversion history stays degraded',
      );
    } else {
      this.outageReported = true;
      this.logger.warn(
        { err: error },
        'MongoDB is unavailable, the conversion history is degraded',
      );
    }

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
