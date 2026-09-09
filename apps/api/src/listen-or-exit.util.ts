import { INestApplication, Logger } from '@nestjs/common';
import { errorStack } from './common/logging/serializers.util';
// Every interface, which is what makes the process reachable from outside its
// container.
const HOST = '0.0.0.0';

// `listen` is the one startup step whose failure Nest neither reports nor ends
// the process for, and a port already in use is the ordinary way to reach it:
// a second copy on one host, a host port collision under Docker.
//
// Two things conspire. Nest flushes the logs buffered by `bufferLogs` from
// inside listen's success callback, so a failed listen strands them — its own
// `EADDRINUSE` line among them — in a buffer nothing will ever empty. And by
// this point the Redis client is connected and ioredis holds the event loop
// open by itself, so `process.exitCode` never takes effect. What was left was a
// process that logged "Redis connection established", said nothing more, served
// nothing, and never exited: to Docker, Railway or systemd, indistinguishable
// from a healthy start, and so never restarted.
//
// Flushing is what makes the failure visible; closing releases the loop and runs
// the shutdown hooks; the exit is what a supervisor reads. The close is
// best-effort, because an app that cannot shut down must not turn a startup
// failure into a hang, and the exit is unconditional, because the whole point is
// that this process must not survive.
export async function listenOrExit(
  app: INestApplication,
  port: number,
): Promise<void> {
  try {
    await app.listen(port, HOST);
  } catch (error) {
    app.flushLogs();

    new Logger('Bootstrap').error(
      `Cannot listen on port ${port}`,
      errorStack(error),
    );

    await app.close().catch(() => undefined);

    process.exit(1);
  }
}
