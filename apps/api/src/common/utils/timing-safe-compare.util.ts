import { timingSafeEqual } from 'node:crypto';

// Compares secrets in constant time for a given length, so a caller cannot
// discover a valid key byte by byte from response timing. The length itself is
// still observable, which is not worth defending against here.
export function timingSafeCompare(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}
