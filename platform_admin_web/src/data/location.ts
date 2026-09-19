/*
 * Optional map location shared by companies and orders. Coordinates are always
 * numbers (never strings) and only exist when a real point was picked; a
 * document with just a written address is fully valid.
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Where the map opens when nothing is selected yet: Khartoum. */
export const DEFAULT_CENTER: GeoPoint = { latitude: 15.5007, longitude: 32.5599 };

export const isValidLatitude = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
export const isValidLongitude = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;

/** Builds a point from stored values; null unless BOTH are valid numbers. */
export function toGeoPoint(latitude: unknown, longitude: unknown): GeoPoint | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return { latitude, longitude };
}

/** Six decimals is about 0.1 m, the precision shown in the UI. */
export const formatCoordinate = (v: number) => v.toFixed(6);

/** Read-only OpenStreetMap link to an exact point (no API key needed). */
export const osmViewUrl = ({ latitude, longitude }: GeoPoint) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';
