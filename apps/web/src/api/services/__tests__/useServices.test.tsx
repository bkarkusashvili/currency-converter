import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeServices } from '../../../test/fakes/createFakeServices';
import { ServicesProvider } from '../ServicesProvider';
import { useServices } from '../useServices';

describe('useServices', () => {
  it('returns the injected services', () => {
    const { services } = createFakeServices();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServicesProvider services={services}>{children}</ServicesProvider>
    );

    const { result } = renderHook(() => useServices(), { wrapper });

    expect(result.current).toBe(services);
  });

  it('refuses to work outside a provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useServices())).toThrow(/ServicesProvider/);

    consoleError.mockRestore();
  });
});
