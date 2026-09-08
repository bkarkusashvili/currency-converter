import { IncomingMessage, ServerResponse } from 'node:http';
import { REQUEST_ID_HEADER } from '../request-id.constant';
import { requestIdMiddleware } from '../request-id.middleware';

function createRequest(): IncomingMessage {
  return { headers: {} } as unknown as IncomingMessage;
}

function createResponse(): { response: ServerResponse; setHeader: jest.Mock } {
  const setHeader = jest.fn();

  return { response: { setHeader } as unknown as ServerResponse, setHeader };
}

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
