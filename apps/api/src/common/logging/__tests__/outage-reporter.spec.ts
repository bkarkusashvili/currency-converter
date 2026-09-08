import { createFakePinoLogger, FakePinoLogger } from './fake-pino-logger';
import { createOutageReporter } from '../outage-reporter';

const MESSAGES = {
  down: 'the dependency is down',
  stillDown: 'the dependency is still down',
  restored: 'the dependency is back',
};

describe('createOutageReporter', () => {
  let logger: FakePinoLogger;

  beforeEach(() => {
    logger = createFakePinoLogger();
  });

  // The whole point: a dependency that is down is observed again on every
  // attempt, and one warning per attempt buries the line that says so.
  it('warns for the outage rather than for each failure of it', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), MESSAGES);

    outage.report(new Error('ECONNREFUSED'));
    outage.report(new Error('ECONNREFUSED'));
    outage.report(new Error('ECONNREFUSED'));

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it('carries the failure as the error field, which is what keeps the stack', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), MESSAGES);
    const failure = new Error('ECONNREFUSED');

    outage.report(failure);

    expect(logger.warn).toHaveBeenCalledWith({ err: failure }, MESSAGES.down);
  });

  // Nothing to carry is not a second way of calling the logger: pino drops a
  // key whose value is undefined, so the line an outage without an error
  // produces is the message and nothing else.
  it('reports an outage that has no failure to carry as the message alone', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), MESSAGES);

    outage.report();

    expect(logger.warn).toHaveBeenCalledWith({ err: undefined }, MESSAGES.down);
    expect(JSON.stringify({ err: undefined })).toBe('{}');
  });

  it('says so once when the outage ends', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), MESSAGES);

    outage.report();
    outage.clear();
    outage.clear();

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(MESSAGES.restored);
  });

  // A caller clears on every success, and a success that followed no outage is
  // not news.
  it('stays quiet when it is cleared without having reported anything', () => {
    createOutageReporter(logger.asPinoLogger(), MESSAGES).clear();

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('warns again for the next outage', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), MESSAGES);

    outage.report();
    outage.clear();
    outage.report();

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  // A burst of conversions against a store that is down would write one line
  // per request, so the repeats can be dropped entirely.
  it('says nothing about a repeat when the caller gave it nothing to say', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), {
      down: MESSAGES.down,
    });

    outage.report();
    outage.report();

    expect(logger.debug).not.toHaveBeenCalled();
  });

  // The caller that has more to say about the recovery than a message says it
  // itself; clearing must not add a second line to that.
  it('ends an outage silently when no recovery message was given', () => {
    const outage = createOutageReporter(logger.asPinoLogger(), {
      down: MESSAGES.down,
    });

    outage.report();
    outage.clear();

    expect(logger.info).not.toHaveBeenCalled();
  });
});
