import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedError } from '../errors/unauthorized.error';
import { ApiKeyGuard } from './api-key.guard';
import type { TypedConfigService } from '../../config/typed-config.service';

function createConfig(adminApiKey: string | null): TypedConfigService {
  return { get: () => adminApiKey } as unknown as TypedConfigService;
}

// Only the header bag is reachable from a guard's ExecutionContext.
function createContext(headers: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  describe('when ADMIN_API_KEY is unset', () => {
    const guard = new ApiKeyGuard(createConfig(null));

    it('allows a request with no key', () => {
      expect(guard.canActivate(createContext({}))).toBe(true);
    });

    it('allows a request that sends an arbitrary key', () => {
      expect(
        guard.canActivate(createContext({ 'x-api-key': 'whatever' })),
      ).toBe(true);
    });
  });

  describe('when ADMIN_API_KEY is configured', () => {
    const guard = new ApiKeyGuard(createConfig('s3cret'));

    it('allows the matching key', () => {
      expect(guard.canActivate(createContext({ 'x-api-key': 's3cret' }))).toBe(
        true,
      );
    });

    it.each([
      ['missing', {}],
      ['wrong', { 'x-api-key': 'nope' }],
      ['empty', { 'x-api-key': '' }],
      ['a prefix of the key', { 'x-api-key': 's3cre' }],
      ['the key plus a suffix', { 'x-api-key': 's3crets' }],
      ['sent as a repeated header', { 'x-api-key': ['s3cret', 's3cret'] }],
      ['of the wrong type', { 'x-api-key': 42 }],
    ])('rejects a key that is %s', (_case, headers) => {
      expect(() => guard.canActivate(createContext(headers))).toThrow(
        UnauthorizedError,
      );
    });

    it('rejects with the 401 envelope error rather than a bare Error', () => {
      try {
        guard.canActivate(createContext({}));
        throw new Error('guard should have rejected the request');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedError);
      }
    });
  });
});
