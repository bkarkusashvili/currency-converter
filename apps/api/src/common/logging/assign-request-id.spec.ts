import { IncomingMessage, ServerResponse } from 'node:http';
import { assignRequestId } from './assign-request-id';
import { REQUEST_ID_HEADER } from './request-id.constant';

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

describe('assignRequestId', () => {
  it('reuses an inbound request id so a trace spans services', () => {
    const { response, setHeader } = createResponse();

    expect(assignRequestId(createRequest('trace-1'), response)).toBe('trace-1');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'trace-1');
  });

  it('trims an inbound id', () => {
    const { response } = createResponse();

    expect(assignRequestId(createRequest('  trace-2  '), response)).toBe(
      'trace-2',
    );
  });

  it.each([
    ['absent', undefined],
    ['blank', '   '],
    ['empty', ''],
    ['a repeated header', ['a', 'b']],
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
