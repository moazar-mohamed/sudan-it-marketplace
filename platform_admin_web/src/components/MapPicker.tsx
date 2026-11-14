import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DEFAULT_CENTER,
  MAP_ATTRIBUTION,
  MAP_TILE_URL,
  formatCoordinate,
  type GeoPoint,
} from '../data/location';
import { useI18n } from '../i18n/I18nProvider';

// A divIcon avoids Leaflet's default marker images, which bundlers do not
// resolve on their own.
const PIN_ICON = L.divIcon({
  className: 'map-pin',
  html: '📍',
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

const SELECTED_ZOOM = 16;

/**
 * Interactive map: click to choose an exact point, click again or drag the
 * pin to move it, optionally jump to the browser's current position, then
 * confirm. Denying the location permission never blocks the map.
 */
export function MapPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: GeoPoint | null;
  onConfirm: (point: GeoPoint) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Captured once so the map is only created a single time.
  const [start] = useState(initial);
  const [point, setPoint] = useState<GeoPoint | null>(initial);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const center = start ?? DEFAULT_CENTER;
    const map = L.map(el).setView(
      [center.latitude, center.longitude],
      start ? SELECTED_ZOOM : 12,
    );
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19, attribution: MAP_ATTRIBUTION }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) =>
      setPoint({ latitude: e.latlng.lat, longitude: e.latlng.lng }),
    );
    mapRef.current = map;
    // The modal has just been laid out; make sure Leaflet measured it.
    const timer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [start]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    const latlng: L.LatLngExpression = [point.latitude, point.longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
      return;
    }
    const marker = L.marker(latlng, { draggable: true, icon: PIN_ICON }).addTo(map);
    marker.on('dragend', () => {
      const moved = marker.getLatLng();
      setPoint({ latitude: moved.lat, longitude: moved.lng });
    });
    markerRef.current = marker;
  }, [point]);

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setNotice(t('location.unavailable'));
      return;
    }
    setNotice('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setPoint(here);
        mapRef.current?.setView([here.latitude, here.longitude], SELECTED_ZOOM);
      },
      (error) => {
        setLocating(false);
        // Denied or unavailable: the map and the address field keep working.
        setNotice(
          error.code === error.PERMISSION_DENIED
            ? t('location.permissionDenied')
            : t('location.unavailable'),
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="map-picker">
      <p className="note">{t('location.tapHint')}</p>
      <div ref={containerRef} className="map-picker__map" />
      <div className="map-picker__coords">
        {point ? (
          <strong>
            {t('location.lat')}: <bdi dir="ltr">{formatCoordinate(point.latitude)}</bdi> ·{' '}
            {t('location.lng')}: <bdi dir="ltr">{formatCoordinate(point.longitude)}</bdi>
          </strong>
        ) : null}
      </div>
      {notice ? <p className="note">{notice}</p> : null}
      <div className="modal__actions map-picker__actions">
        <button type="button" className="btn" onClick={useCurrentLocation} disabled={locating}>
          {locating ? t('location.locating') : `◎ ${t('location.useCurrent')}`}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!point}
          onClick={() => point && onConfirm(point)}
        >
          {t('location.confirm')}
        </button>
      </div>
    </div>
  );
}
