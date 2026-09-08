import { MongooseModuleFactoryOptions } from '@nestjs/mongoose';
import type { TypedConfigService } from '../../config/typed-config.service';
import { buildMongoConnectOptions } from './mongo-connect.options';

export function buildMongooseOptions(
  config: TypedConfigService,
): MongooseModuleFactoryOptions {
  return {
    uri: config.get('MONGO_URL', { infer: true }),
    // Without this the module awaits the first connection and, when Mongo is
    // down, fails the whole boot after its retries. §2 requires the API to come
    // up and keep converting; the history is what degrades.
    lazyConnection: true,
    ...buildMongoConnectOptions(config),
  };
}
