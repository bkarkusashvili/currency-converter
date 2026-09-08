import { describe, expect, it } from 'vitest';
import { WARNING_CODES } from '../../api/types';
import en from '../en.json';
import { API_ERROR_CODES, errorMessageKey } from '../errorMessageKey';
import { warningMessageKey } from '../warningMessageKey';

/** Follows a dotted key into the dictionary, so a key with no sentence is a failure. */
function sentenceFor(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );
}

describe('errorMessageKey', () => {
  it('has a translated message for every code the API can send', () => {
    for (const code of API_ERROR_CODES) {
      const key = errorMessageKey(code);
      expect(key, `no key for ${code}`).not.toBeNull();
      expect(typeof sentenceFor(key as string), `no sentence for ${code}`).toBe('string');
    }
  });

  it('covers the failure the API never sends because it never arrived', () => {
    expect(errorMessageKey('NETWORK_ERROR')).toBe('errors.codes.NETWORK_ERROR');
  });

  it('leaves a code it does not know to the server sentence', () => {
    expect(errorMessageKey('TEAPOT')).toBeNull();
  });
});

describe('warningMessageKey', () => {
  it('has a translated message for every warning code the API can send', () => {
    for (const code of WARNING_CODES) {
      const key = warningMessageKey(code);
      expect(key, `no key for ${code}`).not.toBeNull();
      expect(typeof sentenceFor(key as string), `no sentence for ${code}`).toBe('string');
    }
  });

  it('leaves a code it does not know to the server sentence', () => {
    expect(warningMessageKey('DISK_ON_FIRE')).toBeNull();
  });
});
