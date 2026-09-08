import { IncomingMessage } from 'node:http';
import { getRequestId } from '../get-request-id';

function createRequest(id: unknown): IncomingMessage {
  return { id } as unknown as IncomingMessage;
}

describe('getRequestId', () => {
  it('returns the id pino assigned', () => {
    expect(getRequestId(createRequest('trace-1'))).toBe('trace-1');
  });

  it.each([
    ['undefined', undefined],
    ['a number', 7],
    ['an object', {}],
  ])('returns undefined when the id is %s', (_case, id) => {
    expect(getRequestId(createRequest(id))).toBeUndefined();
  });
});
