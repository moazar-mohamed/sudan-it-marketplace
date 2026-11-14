/**
 * Links that open Google Maps: the app on a phone, the site on a computer.
 * Google's documented "Maps URLs" form needs no key.
 */
const BASE = 'https://www.google.com/maps/search/?api=1&query=';

/** A pin on [latitude], [longitude]. */
export const mapsPointUrl = (latitude: number, longitude: number): string => `${BASE}${latitude},${longitude}`;

/** A search for a written address. */
export const mapsSearchUrl = (address: string): string => `${BASE}${encodeURIComponent(address.trim())}`;
