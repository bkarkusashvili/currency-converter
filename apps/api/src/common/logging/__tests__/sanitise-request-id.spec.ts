import { sanitiseRequestId } from '../sanitise-request-id';

describe('sanitiseRequestId', () => {
  it('accepts an id made of the characters a trace id is built from', () => {
    expect(sanitiseRequestId('trace-1.2_3')).toBe('trace-1.2_3');
  });

  it('trims the surrounding whitespace a proxy may add', () => {
    expect(sanitiseRequestId('  trace-2  ')).toBe('trace-2');
  });

  it('accepts an id exactly at the 128 character cap', () => {
    const id = 'a'.repeat(128);

    expect(sanitiseRequestId(id)).toBe(id);
  });

  it('rejects an id past the cap rather than truncating it into a collision', () => {
    expect(sanitiseRequestId('a'.repeat(129))).toBeNull();
  });

  it.each([
    ['a newline that would forge a log line', 'trace\nlevel=error'],
    ['a header separator', 'trace: injected'],
    ['a space', 'trace 1'],
    ['a control character', 'trace\u0007'],
    ['a non-ascii character', 'tracé'],
    ['a path separator', '../../etc/passwd'],
  ])('rejects %s', (_case, value) => {
    expect(sanitiseRequestId(value)).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['a repeated header', ['a', 'b']],
    ['an empty string', ''],
    ['blank', '   '],
  ])('rejects %s so a fresh id is generated instead', (_case, value) => {
    expect(sanitiseRequestId(value)).toBeNull();
  });
});
