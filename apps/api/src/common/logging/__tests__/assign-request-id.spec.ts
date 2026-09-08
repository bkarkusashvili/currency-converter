import { IncomingMessage, ServerResponse } from 'node:http';
import { assignRequestId } from '../assign-request-id';
import { REQUEST_ID_HEADER } from '../request-id.constant';

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
