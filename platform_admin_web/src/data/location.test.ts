import { describe, expect, it } from 'vitest';
import { formatCoordinate, osmViewUrl, toGeoPoint } from './location';

describe('toGeoPoint', () => {
  it('accepts a numeric pair', () => {
    expect(toGeoPoint(15.5007, 32.5599)).toEqual({ latitude: 15.5007, longitude: 32.5599 });
  });

  it('accepts the range boundaries', () => {
    expect(toGeoPoint(-90, -180)).not.toBeNull();
    expect(toGeoPoint(90, 180)).not.toBeNull();
  });

  it('returns null for legacy documents without coordinates', () => {
    expect(toGeoPoint(undefined, undefined)).toBeNull();
    expect(toGeoPoint(null, null)).toBeNull();
  });

  it('never treats strings as coordinates', () => {
    expect(toGeoPoint('15.5', '32.5')).toBeNull();
  });

  it('needs both values and rejects out-of-range / non-finite numbers', () => {
    expect(toGeoPoint(15.5, undefined)).toBeNull();
    expect(toGeoPoint(91, 10)).toBeNull();
    expect(toGeoPoint(10, 181)).toBeNull();
    expect(toGeoPoint(NaN, 10)).toBeNull();
    expect(toGeoPoint(10, Infinity)).toBeNull();
  });
});

describe('formatting', () => {
  it('shows six decimals', () => {
    expect(formatCoordinate(15.5)).toBe('15.500000');
  });

  it('links to the exact point', () => {
    expect(osmViewUrl({ latitude: 15.5, longitude: 32.25 })).toBe(
      'https://www.openstreetmap.org/?mlat=15.5&mlon=32.25#map=17/15.5/32.25',
    );
  });
});
