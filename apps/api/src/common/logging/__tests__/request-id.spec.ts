import { IncomingMessage, ServerResponse } from 'node:http';
import {
  assignRequestId,
  getRequestId,
  REQUEST_ID_HEADER,
  requestIdMiddleware,
  sanitiseRequestId,
} from '../request-id';

function createRequest(headerValue?: string | string[]): IncomingMessage {
  return {
    headers:
      headerValue === undefined ? {} : { [REQUEST_ID_HEADER]: headerValue },
  } as unknown as IncomingMessage;
}

function createResponse(): { response: ServerResponse; setHeader: jest.Mock } {
  const setHeader = jest.fn();

  return { response: { setHeader } as unknown as ServerResponse, setHeader };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('sanitiseRequestId', () => {
  it('accepts an id made of the characters a trace id is built from', () => {
    expect(sanitiseRequestId('trace-1.2_3')).toBe('trace-1.2_3');
  });

  it('trims the surrounding whitespace a proxy may add', () => {
    expect(sanitiseRequestId('  trace-2  ')).toBe('trace-2');
  });

  it('accepts an id exactly at the 128 character cap', () => {
    const id = 'a'.repeat(128);

    expect(sanitiseRequestId(id)).toBe(id);
  });

  it('rejects an id past the cap rather than truncating it into a collision', () => {
    expect(sanitiseRequestId('a'.repeat(129))).toBeNull();
  });

  it.each([
    ['a newline that would forge a log line', 'trace\nlevel=error'],
    ['a header separator', 'trace: injected'],
    ['a space', 'trace 1'],
    ['a control character', 'trace\u0007'],
    ['a non-ascii character', 'tracé'],
    ['a path separator', '../../etc/passwd'],
  ])('rejects %s', (_case, value) => {
    expect(sanitiseRequestId(value)).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['a repeated header', ['a', 'b']],
    ['an empty string', ''],
    ['blank', '   '],
  ])('rejects %s so a fresh id is generated instead', (_case, value) => {
    expect(sanitiseRequestId(value)).toBeNull();
  });
});

function requestWithId(id: unknown): IncomingMessage {
  return { id } as unknown as IncomingMessage;
}

describe('getRequestId', () => {
  it('returns the id pino assigned', () => {
    expect(getRequestId(requestWithId('trace-1'))).toBe('trace-1');
  });

  it.each([
    ['undefined', undefined],
    ['a number', 7],
    ['an object', {}],
  ])('returns undefined when the id is %s', (_case, id) => {
    expect(getRequestId(requestWithId(id))).toBeUndefined();
  });
});

describe('assignRequestId', () => {
  it('reuses an inbound request id so a trace spans services', () => {
    const { response, setHeader } = createResponse();

    expect(assignRequestId(createRequest('trace-1'), response)).toBe('trace-1');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'trace-1');
  });

  it('publishes the id on the request so later middleware finds it', () => {
    const { response } = createResponse();
    const request = createRequest('trace-1');

    assignRequestId(request, response);

    expect(request.id).toBe('trace-1');
  });

  it('returns the id already on the request instead of minting a second one', () => {
    const { response, setHeader } = createResponse();
    const request = createRequest('trace-1');

    assignRequestId(request, response);
    setHeader.mockClear();

    expect(assignRequestId(request, response)).toBe('trace-1');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', undefined],
    ['blank', '   '],
    ['a repeated header', ['a', 'b']],
    ['past the length cap', 'a'.repeat(129)],
    ['carrying characters a log line cannot hold', 'trace\ninjected'],
  ])('generates a uuid when the inbound id is %s', (_case, headerValue) => {
    const { response, setHeader } = createResponse();

    const requestId = assignRequestId(createRequest(headerValue), response);

    expect(requestId).toMatch(UUID_PATTERN);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
  });

  it('generates a distinct id per request', () => {
    const { response } = createResponse();

    expect(assignRequestId(createRequest(), response)).not.toBe(
      assignRequestId(createRequest(), response),
    );
  });
});

describe('requestIdMiddleware', () => {
  it('leaves an id on the request before handing over', () => {
    const request = createRequest();
    const next = jest.fn(() => {
      expect(typeof request.id).toBe('string');
    });

    requestIdMiddleware(request, createResponse().response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('echoes the id it chose back to the caller', () => {
    const request = createRequest();
    const { response, setHeader } = createResponse();

    requestIdMiddleware(request, response, jest.fn());

    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, request.id);
  });
});
