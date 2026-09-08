import type { TypedConfigService } from '../../../config/typed-config.service';
import { buildMongoConnectOptions } from '../mongo-connect.options';
import { buildMongooseOptions } from '../mongoose.options';

const SERVER_SELECTION_TIMEOUT_MS = 2500;
const MONGO_URL = 'mongodb://mongo:27017/currency_converter';

const config = {
  get: (key: string): unknown =>
    ({
      MONGO_URL,
      MONGO_SERVER_SELECTION_TIMEOUT_MS: SERVER_SELECTION_TIMEOUT_MS,
    })[key],
} as unknown as TypedConfigService;

describe('buildMongoConnectOptions', () => {
  // The three options §2 rests on: a command issued while the connection is
  // down fails now rather than sitting in a buffer, the driver gives up looking
  // for a server inside a request's budget, and index creation is this
  // module's own step rather than one mongoose swallows the failure of.
  it('never buffers a command and bounds the search for a server', () => {
    expect(buildMongoConnectOptions(config)).toStrictEqual({
      bufferCommands: false,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      autoIndex: false,
      autoCreate: false,
    });
  });
});

describe('buildMongooseOptions', () => {
  it('connects to the configured url', () => {
    expect(buildMongooseOptions(config)).toMatchObject({ uri: MONGO_URL });
  });

  // Awaiting the first connection is what would fail the boot of an API that
  // §2 requires to come up and keep converting while Mongo is down.
  it('does not make the module wait for the connection', () => {
    expect(buildMongooseOptions(config)).toMatchObject({
      lazyConnection: true,
    });
  });

  it('opens the connection with the options every retry uses', () => {
    expect(buildMongooseOptions(config)).toMatchObject(
      buildMongoConnectOptions(config),
    );
  });
});
