import { errorStack } from '../error-stack';

describe('errorStack', () => {
  it('reports the stack of an error, which is what carries the frames', () => {
    const failure = new Error('EADDRINUSE');

    expect(errorStack(failure)).toBe(failure.stack);
  });

  // A rejection is not always an Error, and the message is better than the
  // "[object Object]" a bare cast would log.
  it('falls back to the message when the error carries no stack', () => {
    const failure = new Error('no frames');
    failure.stack = undefined;

    expect(errorStack(failure)).toBe('no frames');
  });

  it('describes something that was thrown and is not an error at all', () => {
    expect(errorStack('just a string')).toBe('just a string');
  });
});
