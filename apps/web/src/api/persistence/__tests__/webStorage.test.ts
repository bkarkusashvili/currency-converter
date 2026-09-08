import { describe, expect, it, vi } from 'vitest';
import { webStorage } from '../webStorage';

function stubLocalStorage(value: Storage | null): void {
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(value as Storage);
}

function throwingStorage(): Storage {
  const boom = () => {
    throw new Error('storage is disabled');
  };
  return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
}

describe('webStorage', () => {
  it('reads and writes through localStorage', () => {
    const storage = webStorage();

    storage?.setItem('probe', 'value');
    expect(storage?.getItem('probe')).toBe('value');

    storage?.removeItem('probe');
    expect(storage?.getItem('probe')).toBeNull();
  });

  it('is unavailable when reading the property throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('site data is blocked');
    });

    expect(webStorage()).toBeNull();
  });

  it('is unavailable when the browser has no localStorage at all', () => {
    stubLocalStorage(null);

    expect(webStorage()).toBeNull();
  });

  it('swallows a storage that throws on every call', () => {
    stubLocalStorage(throwingStorage());
    const storage = webStorage();

    expect(storage?.getItem('probe')).toBeNull();
    expect(() => storage?.setItem('probe', 'value')).not.toThrow();
    expect(() => storage?.removeItem('probe')).not.toThrow();
  });
});
