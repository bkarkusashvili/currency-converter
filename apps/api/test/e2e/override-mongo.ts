import { getConnectionToken } from '@nestjs/mongoose';
import { TestingModuleBuilder } from '@nestjs/testing';
import { FakeMongoConnection } from '../../src/infrastructure/mongo/__tests__/fake-mongo-connection';

// /health reports the database, so a suite with no Mongo to talk to would be
// asserting on the runner rather than on the app. The fake stands in for the
// driver's connection, which is also what keeps a suite from opening one to
// whatever Mongo the developer happens to have running.
export function overrideMongo(
  builder: TestingModuleBuilder,
  connection: FakeMongoConnection = connected(),
): TestingModuleBuilder {
  return builder
    .overrideProvider(getConnectionToken())
    .useValue(connection.asConnection());
}

export function connected(): FakeMongoConnection {
  const connection = new FakeMongoConnection();
  connection.settle();

  return connection;
}
