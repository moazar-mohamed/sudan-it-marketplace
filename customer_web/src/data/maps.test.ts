import { describe, expect, it } from 'vitest';
import { mapsPointUrl, mapsSearchUrl } from './maps';

describe('Google Maps links', () => {
  it('puts a pin on the point', () => {
    expect(mapsPointUrl(15.5007, 32.5599)).toBe('https://www.google.com/maps/search/?api=1&query=15.5007,32.5599');
  });

  it('searches for an Arabic address, encoded', () => {
    const url = mapsSearchUrl(' الخرطوم، شارع 15 ');
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(decodeURIComponent(url.split('query=')[1])).toBe('الخرطوم، شارع 15');
  });
});
