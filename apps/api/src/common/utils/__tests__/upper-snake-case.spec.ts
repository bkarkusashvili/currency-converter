import { upperSnakeCase } from '../upper-snake-case';

describe('upperSnakeCase', () => {
  it.each([
    ['Not Acceptable', 'NOT_ACCEPTABLE'],
    ['NotAcceptable', 'NOT_ACCEPTABLE'],
    ['Payload Too Large', 'PAYLOAD_TOO_LARGE'],
    ["I'm a Teapot", 'I_M_A_TEAPOT'],
    ['UNSUPPORTED_MEDIA_TYPE', 'UNSUPPORTED_MEDIA_TYPE'],
    ['http2 Required', 'HTTP2_REQUIRED'],
  ])('turns %s into %s', (value, expected) => {
    expect(upperSnakeCase(value)).toBe(expected);
  });

  it('drops the separators a name starts or ends with', () => {
    expect(upperSnakeCase('  spaced out  ')).toBe('SPACED_OUT');
  });

  it('produces nothing from a name with no usable characters', () => {
    expect(upperSnakeCase('   ')).toBe('');
  });

  it('bounds a name so it cannot grow the envelope', () => {
    expect(upperSnakeCase('a'.repeat(200))).toHaveLength(48);
  });

  it('does not leave the separator a cut landed on', () => {
    expect(upperSnakeCase(`${'a'.repeat(47)} tail`)).toBe('A'.repeat(47));
  });
});
