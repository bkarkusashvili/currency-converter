import { describe, expect, it } from 'vitest';
import { outcomeOf, shortenRequestId } from '../lib/sessionActions';

describe('shortenRequestId', () => {
  it('keeps enough of the id to match a log line against', () => {
    expect(shortenRequestId('3b91c0de-dead-beef-0000-0000000000e0')).toBe('3b91…e0');
  });

  it('leaves a short id alone rather than making it shorter', () => {
    expect(shortenRequestId('req-42')).toBe('req-42');
  });
});

describe('outcomeOf', () => {
  it('names the three answers the route can give', () => {
    expect(outcomeOf(204)).toBe('cleared');
    expect(outcomeOf(401)).toBe('unauthorized');
    expect(outcomeOf(503)).toBe('failed');
  });
});
