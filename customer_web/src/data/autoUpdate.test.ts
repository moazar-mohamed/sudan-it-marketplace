import { describe, expect, it } from 'vitest';
import { isNewer } from './autoUpdate';

describe('picking up a new version', () => {
  it('moves only to a different, known build', () => {
    expect(isNewer('a', 'b')).toBe(true);
    expect(isNewer('a', 'a')).toBe(false);
  });

  it('changes nothing when a build is unknown', () => {
    expect(isNewer(undefined, 'b')).toBe(false);
    expect(isNewer('a', undefined)).toBe(false);
    expect(isNewer('a', '')).toBe(false);
    expect(isNewer('a', 5)).toBe(false);
  });
});
