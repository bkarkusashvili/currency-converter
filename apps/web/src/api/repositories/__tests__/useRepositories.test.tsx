import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeRepositories } from '../../../test/fakes/createFakeRepositories';
import { RepositoriesProvider } from '../RepositoriesProvider';
import { useRepositories } from '../useRepositories';

describe('useRepositories', () => {
  it('returns the injected repositories', () => {
    const { repositories } = createFakeRepositories();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepositoriesProvider repositories={repositories}>{children}</RepositoriesProvider>
    );

    const { result } = renderHook(() => useRepositories(), { wrapper });

    expect(result.current).toBe(repositories);
  });

  it('refuses to work outside a provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useRepositories())).toThrow(/RepositoriesProvider/);

    consoleError.mockRestore();
  });
});
