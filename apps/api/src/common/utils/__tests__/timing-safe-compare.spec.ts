import { timingSafeCompare } from '../timing-safe-compare.util';

describe('timingSafeCompare', () => {
  it('accepts identical strings', () => {
    expect(timingSafeCompare('s3cret', 's3cret')).toBe(true);
  });

  it('accepts two empty strings', () => {
    expect(timingSafeCompare('', '')).toBe(true);
  });

  it.each([
    ['different content of equal length', 'abcdef', 'abcdeg'],
    ['a shorter candidate', 's3cret', 's3cre'],
    ['a longer candidate', 's3cret', 's3crets'],
    ['an empty candidate', 's3cret', ''],
  ])('rejects %s', (_case, left, right) => {
    expect(timingSafeCompare(left, right)).toBe(false);
  });

  it('compares by bytes, so multi-byte characters do not collide', () => {
    expect(timingSafeCompare('é', 'e')).toBe(false);
    expect(timingSafeCompare('é', 'é')).toBe(true);
  });
});
