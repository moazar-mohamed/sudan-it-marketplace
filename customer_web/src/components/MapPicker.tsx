import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../i18n';

// OpenStreetMap tiles need no key or billing, as in the app (map_config.dart).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';
/** Where the map opens when nothing is selected yet: Khartoum. */
const DEFAULT_CENTER: L.LatLngTuple = [15.5007, 32.5599];
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 16;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const pin = L.divIcon({ className: 'map-pin', iconSize: [22, 22], iconAnchor: [11, 11] });

const GEO_ERRORS: Record<number, string> = {
  1: t('تم رفض إذن الموقع. يمكنك الضغط على الخريطة أو كتابة العنوان.'),
  2: t('تعذر الحصول على موقعك الحالي. يمكنك الضغط على الخريطة.'),
  3: t('تعذر الحصول على موقعك الحالي. يمكنك الضغط على الخريطة.'),
};

/** Tap the map to choose an exact point, tap again to move it, then confirm. */
export default function MapPicker({
  initial,
  onConfirm,
  onClose,
}: {
  initial: GeoPoint | null;
  onConfirm: (point: GeoPoint) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [selected, setSelected] = useState<GeoPoint | null>(initial);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!box.current) return;
    const start: L.LatLngTuple = initial ? [initial.latitude, initial.longitude] : DEFAULT_CENTER;
    const created = L.map(box.current).setView(start, initial ? SELECTED_ZOOM : DEFAULT_ZOOM);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(created);
    created.on('click', (e: L.LeafletMouseEvent) => {
      setSelected({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; `selected` drives the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = map.current;
    if (!current || !selected) return;
    const at: L.LatLngTuple = [selected.latitude, selected.longitude];
    if (marker.current) marker.current.setLatLng(at);
    else marker.current = L.marker(at, { icon: pin }).addTo(current);
  }, [selected]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNote(GEO_ERRORS[2]);
      return;
    }
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setSelected(point);
        map.current?.setView([point.latitude, point.longitude], SELECTED_ZOOM);
        setLocating(false);
      },
      (error) => {
        setNote(GEO_ERRORS[error.code] ?? GEO_ERRORS[2]);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette map-panel" role="dialog" aria-modal="true" aria-label={t('الموقع')}>
        <p className="map-hint">{t('اضغط على الخريطة لتحديد النقطة بدقة. اضغط مرة أخرى لتحريكها.')}</p>
        <div className="map-box" ref={box} dir="ltr" />
        <div className="map-foot">
          {selected && (
            <span className="pmeta" dir="ltr">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</span>
          )}
          {note && <div className="error" role="status" style={{ marginTop: 0 }}>{note}</div>}
          <div className="buy-row">
            <button className="btn-line" disabled={locating} onClick={useMyLocation}>{t('استخدام موقعي الحالي')}</button>
            <button className="btn-solid" disabled={!selected} onClick={() => selected && onConfirm(selected)}>{t('تأكيد الموقع')}</button>
          </div>
          <button className="link-btn" onClick={onClose}>{t('إلغاء')}</button>
        </div>
      </div>
    </div>
  );
}
