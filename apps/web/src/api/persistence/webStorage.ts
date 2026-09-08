/** The slice of `Storage` the persister uses, so a caller can hand it anything that stores strings. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * `window.localStorage` is not something a browser can be assumed to have:
 * reading the property throws when site data is blocked, it is `null` in some
 * Android WebViews, and `setItem` throws on a full quota or in a private
 * window. Every call is wrapped and the whole thing degrades to `null`, which
 * is what tells the app to run without persistence rather than fail to start.
 */
export function webStorage(): KeyValueStorage | null {
  let storage: Storage | null;

  try {
    storage = window.localStorage;
  } catch {
    return null;
  }

  if (storage === null) {
    return null;
  }

  const available = storage;

  return {
    getItem(key) {
      try {
        return available.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        available.setItem(key, value);
      } catch {
        // Quota exceeded or storage disabled mid-session: the cache is a bonus, not a requirement.
      }
    },
    removeItem(key) {
      try {
        available.removeItem(key);
      } catch {
        // As above.
      }
    },
  };
}
